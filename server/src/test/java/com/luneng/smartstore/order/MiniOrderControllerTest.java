package com.luneng.smartstore.order;

import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.luneng.smartstore.auth.ActorType;
import com.luneng.smartstore.auth.CurrentPrincipal;
import com.luneng.smartstore.auth.JwtService;
import com.luneng.smartstore.support.IntegrationTestBase;
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

    private String customerToken;

    @BeforeEach
    void setUp() {
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
            .andExpect(jsonPath("$.data.status").value("PENDING_CONFIRMATION"));

        mockMvc.perform(get("/api/mini/orders")
                .header("Authorization", "Bearer " + customerToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.items[0].totalCent").value(1180))
            .andExpect(jsonPath("$.data.total").value(1));
    }
}
