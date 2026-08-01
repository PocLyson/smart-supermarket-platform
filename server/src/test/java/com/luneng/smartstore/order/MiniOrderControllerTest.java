package com.luneng.smartstore.order;

import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.hamcrest.Matchers.matchesPattern;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.luneng.smartstore.auth.ActorType;
import com.luneng.smartstore.auth.CurrentPrincipal;
import com.luneng.smartstore.auth.JwtService;
import com.luneng.smartstore.support.IntegrationTestBase;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

@AutoConfigureMockMvc
class MiniOrderControllerTest extends IntegrationTestBase {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private StringRedisTemplate redisTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    private String customerToken;

    @BeforeEach
    void setUp() {
        jdbcTemplate.update("delete from operation_log");
        jdbcTemplate.update("delete from idempotency_record");
        jdbcTemplate.update("delete from inventory_ledger");
        jdbcTemplate.update("delete from order_status_history");
        jdbcTemplate.update("delete from order_item");
        jdbcTemplate.update("delete from customer_order");
        jdbcTemplate.update("delete from online_inventory");
        jdbcTemplate.update("delete from product");
        jdbcTemplate.update("delete from category");
        jdbcTemplate.update("delete from customer_user");
        jdbcTemplate.update(
            "insert into customer_user(id, openid, enabled) values (1, 'openid-1', true)"
        );
        jdbcTemplate.update(
            "insert into category(id, name, sort_order, enabled) values (1, '乳制品', 1, true)"
        );
        jdbcTemplate.update(
            """
            insert into product(id, category_id, name, price_cent, unit, on_shelf)
            values (10, 1, '纯牛奶', 590, '盒', true)
            """
        );
        jdbcTemplate.update(
            "insert into online_inventory(product_id, available_quantity, version) values (10, 10, 0)"
        );
        redisTemplate.opsForValue().set("auth:session:customer-session", "1");
        customerToken = jwtService.issue(
            new CurrentPrincipal(1L, ActorType.CUSTOMER, "CUSTOMER", "customer-session")
        );
    }

    @Test
    void createOrderRequiresCustomerAndIdempotencyKey() throws Exception {
        mockMvc.perform(post("/api/mini/orders")
                .header("Authorization", "Bearer " + customerToken)
                .header("Idempotency-Key", "http-001")
                .contentType(APPLICATION_JSON)
                .content("""
                    {
                      "pickupName": "李先生",
                      "phone": "13800138000",
                      "items": [{"productId": 10, "quantity": 2}]
                    }
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.totalCent").value(1180))
            .andExpect(jsonPath("$.data.pickupCode").value(matchesPattern("\\d{6}")))
            .andExpect(jsonPath("$.data.status").value("PENDING_CONFIRMATION"));

        mockMvc.perform(get("/api/mini/orders")
                .header("Authorization", "Bearer " + customerToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.items[0].totalCent").value(1180))
            .andExpect(jsonPath("$.data.total").value(1));
    }

    @Test
    void createOrderStoresAndReturnsTrimmedCustomerNote() throws Exception {
        mockMvc.perform(post("/api/mini/orders")
                .header("Authorization", "Bearer " + customerToken)
                .header("Idempotency-Key", "note-001")
                .contentType(APPLICATION_JSON)
                .content("""
                    {
                      "pickupName": "李先生",
                      "phone": "13800138000",
                      "customerNote": "  饮料要常温，易碎品请轻放  ",
                      "items": [{"productId": 10, "quantity": 1}]
                    }
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.customerNote")
                .value("饮料要常温，易碎品请轻放"));

        org.assertj.core.api.Assertions.assertThat(jdbcTemplate.queryForObject(
            "select customer_note from customer_order where idempotency_key = ?",
            String.class,
            "note-001"
        )).isEqualTo("饮料要常温，易碎品请轻放");
    }

    @Test
    void createOrderRemainsCompatibleWhenCustomerNoteIsMissing() throws Exception {
        mockMvc.perform(post("/api/mini/orders")
                .header("Authorization", "Bearer " + customerToken)
                .header("Idempotency-Key", "note-missing")
                .contentType(APPLICATION_JSON)
                .content("""
                    {
                      "pickupName": "李先生",
                      "phone": "13800138000",
                      "items": [{"productId": 10, "quantity": 1}]
                    }
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.customerNote").doesNotExist());
    }

    @Test
    void createOrderRejectsCustomerNoteLongerThanOneHundredCharacters() throws Exception {
        String note = "备".repeat(101);
        mockMvc.perform(post("/api/mini/orders")
                .header("Authorization", "Bearer " + customerToken)
                .header("Idempotency-Key", "note-too-long")
                .contentType(APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                    "pickupName", "李先生",
                    "phone", "13800138000",
                    "customerNote", note,
                    "items", List.of(Map.of("productId", 10, "quantity", 1))
                ))))
            .andExpect(status().isBadRequest());
    }

    @Test
    void createOrderAcceptsOneHundredCharacterCustomerNoteWithSurroundingWhitespace()
        throws Exception {
        String note = "备".repeat(100);
        mockMvc.perform(post("/api/mini/orders")
                .header("Authorization", "Bearer " + customerToken)
                .header("Idempotency-Key", "note-trimmed-boundary")
                .contentType(APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                    "pickupName", "李先生",
                    "phone", "13800138000",
                    "customerNote", "  " + note + "  ",
                    "items", List.of(Map.of("productId", 10, "quantity", 1))
                ))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.customerNote").value(note));

        org.assertj.core.api.Assertions.assertThat(jdbcTemplate.queryForObject(
            "select customer_note from customer_order where idempotency_key = ?",
            String.class,
            "note-trimmed-boundary"
        )).isEqualTo(note);
    }

    @Test
    void createOrderAcceptsOverlongBlankCustomerNoteAsNull() throws Exception {
        mockMvc.perform(post("/api/mini/orders")
                .header("Authorization", "Bearer " + customerToken)
                .header("Idempotency-Key", "note-blank")
                .contentType(APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                    "pickupName", "李先生",
                    "phone", "13800138000",
                    "customerNote", " ".repeat(101),
                    "items", List.of(Map.of("productId", 10, "quantity", 1))
                ))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.customerNote").doesNotExist());

        org.assertj.core.api.Assertions.assertThat(jdbcTemplate.queryForObject(
            "select customer_note from customer_order where idempotency_key = ?",
            String.class,
            "note-blank"
        )).isNull();
    }

    @Test
    void customerCanHideTerminalOrderWithoutDeletingBusinessRecord() throws Exception {
        insertOrder("COMPLETED-1", "COMPLETED");

        mockMvc.perform(delete("/api/mini/orders/COMPLETED-1")
                .header("Authorization", "Bearer " + customerToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.deleted").value(true));

        mockMvc.perform(get("/api/mini/orders")
                .header("Authorization", "Bearer " + customerToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.total").value(0));

        org.assertj.core.api.Assertions.assertThat(jdbcTemplate.queryForObject(
            "select count(*) from customer_order where order_no = 'COMPLETED-1'",
            Integer.class
        )).isEqualTo(1);
    }

    @Test
    void customerCannotHideActiveOrder() throws Exception {
        insertOrder("ACTIVE-1", "PREPARING");

        mockMvc.perform(delete("/api/mini/orders/ACTIVE-1")
                .header("Authorization", "Bearer " + customerToken))
            .andExpect(status().isConflict());

        mockMvc.perform(get("/api/mini/orders")
                .header("Authorization", "Bearer " + customerToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.total").value(1));
    }

    private void insertOrder(String orderNo, String status) {
        jdbcTemplate.update(
            """
            insert into customer_order(
                order_no, customer_id, idempotency_key, pickup_name, phone,
                total_cent, status, payment_status, inventory_released
            ) values (?, 1, ?, '李先生', '13800138000', 590, ?, 'UNPAID', false)
            """,
            orderNo,
            "key-" + orderNo,
            status
        );
    }
}
