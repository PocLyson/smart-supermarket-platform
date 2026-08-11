package com.luneng.smartstore.merchant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.luneng.smartstore.auth.ActorType;
import com.luneng.smartstore.auth.ClientType;
import com.luneng.smartstore.auth.CurrentPrincipal;
import com.luneng.smartstore.auth.JwtService;
import com.luneng.smartstore.order.AdminOrderService;
import com.luneng.smartstore.order.CreateOrderCommand;
import com.luneng.smartstore.order.CreateOrderItem;
import com.luneng.smartstore.order.OrderApplicationService;
import com.luneng.smartstore.order.OrderStatus;
import com.luneng.smartstore.order.PaymentStatus;
import com.luneng.smartstore.support.IntegrationTestBase;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

@AutoConfigureMockMvc
class MerchantOrderApiTest extends IntegrationTestBase {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private StringRedisTemplate redisTemplate;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private OrderApplicationService customerOrders;

    @Autowired
    private AdminOrderService adminOrders;

    private CurrentPrincipal cashier;
    private String cashierToken;
    private String ownerToken;
    private String orderNo;

    @BeforeEach
    void setUp() {
        Set<String> redisKeys = redisTemplate.keys("auth:*");
        if (!redisKeys.isEmpty()) {
            redisTemplate.delete(redisKeys);
        }
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
            "insert into customer_user(id, openid, enabled) values (1, 'merchant-order-owner', true)"
        );
        jdbcTemplate.update(
            "insert into category(id, name, sort_order, enabled) values (1, 'Dairy', 1, true)"
        );
        jdbcTemplate.update(
            """
            insert into product(id, category_id, name, price_cent, unit, on_shelf)
            values (10, 1, 'Milk', 590, 'bottle', true)
            """
        );
        jdbcTemplate.update(
            "insert into online_inventory(product_id, available_quantity, version) values (10, 5, 0)"
        );
        orderNo = customerOrders.create(new CreateOrderCommand(
            1L,
            "merchant-order-test",
            "Customer",
            "13800138000",
            null,
            List.of(new CreateOrderItem(10L, 2))
        )).orderNo();
        cashier = merchantPrincipal(9L, "CASHIER", "merchant-cashier-session");
        CurrentPrincipal owner = merchantPrincipal(8L, "OWNER", "merchant-owner-session");
        cashierToken = token(cashier);
        ownerToken = token(owner);
    }

    @Test
    void merchantListDetailAndCashierCanAcceptReadyAndConfirmPayAtStore() throws Exception {
        mockMvc.perform(get("/api/merchant-mini/orders")
                .header("Authorization", "Bearer " + cashierToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.items[0].orderNo").value(orderNo))
            .andExpect(jsonPath("$.data.items[0].pickupCode").doesNotExist());

        mockMvc.perform(get("/api/merchant-mini/orders/{orderNo}", orderNo)
                .header("Authorization", "Bearer " + cashierToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.status").value("PENDING_CONFIRMATION"))
            .andExpect(jsonPath("$.data.pickupCode").doesNotExist());

        mockMvc.perform(post("/api/merchant-mini/orders/{orderNo}/accept", orderNo)
                .header("Authorization", "Bearer " + cashierToken)
                .header("X-Request-Id", "merchant-accept-1"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.status").value("PREPARING"));

        mockMvc.perform(post("/api/merchant-mini/orders/{orderNo}/ready", orderNo)
                .header("Authorization", "Bearer " + cashierToken)
                .header("X-Request-Id", "merchant-ready-1"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.status").value("READY_FOR_PICKUP"));

        mockMvc.perform(post("/api/merchant-mini/orders/{orderNo}/pay", orderNo)
                .header("Authorization", "Bearer " + cashierToken)
                .header("X-Request-Id", "merchant-pay-1")
                .contentType(APPLICATION_JSON)
                .content("{\"method\":\"WECHAT_QR\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.paymentStatus").value("PAID"))
            .andExpect(jsonPath("$.data.paymentMethod").value("WECHAT_QR"));
    }

    @Test
    void cashierCannotCancelButOwnerCanCancel() throws Exception {
        mockMvc.perform(post("/api/merchant-mini/orders/{orderNo}/cancel", orderNo)
                .header("Authorization", "Bearer " + cashierToken)
                .contentType(APPLICATION_JSON)
                .content("{\"reason\":\"cashier must not cancel\"}"))
            .andExpect(status().isForbidden());
        assertThat(orderStatus()).isEqualTo(OrderStatus.PENDING_CONFIRMATION);

        mockMvc.perform(post("/api/merchant-mini/orders/{orderNo}/cancel", orderNo)
                .header("Authorization", "Bearer " + ownerToken)
                .header("X-Request-Id", "merchant-owner-cancel-1")
                .contentType(APPLICATION_JSON)
                .content("{\"reason\":\"customer requested cancellation\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.status").value("CANCELLED"));
        assertThat(orderStatus()).isEqualTo(OrderStatus.CANCELLED);
    }

    @Test
    void verifyPickupValidatesCodeBeforePayingAndCompletesAtomically() throws Exception {
        prepareForPickup();
        assertThat(jdbcTemplate.queryForObject(
            """
            select count(*) from information_schema.columns
            where table_schema = database()
              and table_name = 'customer_order'
              and column_name = 'pickup_code'
            """,
            Integer.class
        )).isEqualTo(1);
        String pickupCode = jdbcTemplate.queryForObject(
            "select pickup_code from customer_order where order_no = ?",
            String.class,
            orderNo
        );

        mockMvc.perform(post("/api/merchant-mini/orders/{orderNo}/verify-pickup", orderNo)
                .header("Authorization", "Bearer " + cashierToken)
                .header("X-Request-Id", "merchant-pickup-1")
                .contentType(APPLICATION_JSON)
                .content("""
                    {"pickupCode":"%s","payAtStoreMethod":"CASH"}
                    """.formatted(pickupCode)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.status").value("COMPLETED"))
            .andExpect(jsonPath("$.data.paymentStatus").value("PAID"))
            .andExpect(jsonPath("$.data.paymentMethod").value("CASH"))
            .andExpect(jsonPath("$.data.pickupCode").doesNotExist());

        assertThat(jdbcTemplate.queryForObject(
            "select count(*) from order_status_history h join customer_order o on o.id = h.order_id where o.order_no = ? and h.to_status = 'COMPLETED'",
            Integer.class,
            orderNo
        )).isEqualTo(1);
    }

    @Test
    void pickupPreviewFindsReadyOrderByCodeWithoutExposingTheSecret() throws Exception {
        prepareForPickup();
        String pickupCode = jdbcTemplate.queryForObject(
            "select pickup_code from customer_order where order_no = ?",
            String.class,
            orderNo
        );

        mockMvc.perform(get("/api/merchant-mini/orders/pickup-preview")
                .header("Authorization", "Bearer " + cashierToken)
                .param("pickupCode", pickupCode))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.orderNo").value(orderNo))
            .andExpect(jsonPath("$.data.status").value("READY_FOR_PICKUP"))
            .andExpect(jsonPath("$.data.pickupCode").doesNotExist());
    }

    @Test
    void invalidPickupCodeLeavesOrderUnpaidAndReady() throws Exception {
        prepareForPickup();
        String pickupCode = customerOrders.detail(1L, orderNo).pickupCode();
        String invalidCode = pickupCode.equals("000000") ? "111111" : "000000";

        mockMvc.perform(post("/api/merchant-mini/orders/{orderNo}/verify-pickup", orderNo)
                .header("Authorization", "Bearer " + cashierToken)
                .header("X-Request-Id", "merchant-pickup-invalid")
                .contentType(APPLICATION_JSON)
                .content("""
                    {"pickupCode":"%s","payAtStoreMethod":"CASH"}
                    """.formatted(invalidCode)))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("PICKUP_CODE_MISMATCH"));

        assertThat(orderStatus()).isEqualTo(OrderStatus.READY_FOR_PICKUP);
        assertThat(jdbcTemplate.queryForObject(
            "select payment_status from customer_order where order_no = ?",
            String.class,
            orderNo
        )).isEqualTo(PaymentStatus.UNPAID.name());
        assertThat(jdbcTemplate.queryForObject(
            "select count(*) from operation_log where request_id = 'merchant-pickup-invalid'",
            Integer.class
        )).isZero();
    }

    @Test
    void duplicateVerifyPickupRequestReturnsFinalViewWithoutDuplicateHistory() throws Exception {
        prepareForPickup();
        String pickupCode = customerOrders.detail(1L, orderNo).pickupCode();
        String body = "{\"pickupCode\":\"%s\",\"payAtStoreMethod\":\"WECHAT_QR\"}"
            .formatted(pickupCode);

        for (int request = 0; request < 2; request++) {
            mockMvc.perform(post("/api/merchant-mini/orders/{orderNo}/verify-pickup", orderNo)
                    .header("Authorization", "Bearer " + cashierToken)
                    .header("X-Request-Id", "merchant-pickup-duplicate")
                    .contentType(APPLICATION_JSON)
                    .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("COMPLETED"))
                .andExpect(jsonPath("$.data.paymentStatus").value("PAID"));
        }

        assertThat(jdbcTemplate.queryForObject(
            "select count(*) from order_status_history h join customer_order o on o.id = h.order_id where o.order_no = ? and h.to_status = 'COMPLETED'",
            Integer.class,
            orderNo
        )).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject(
            "select count(*) from operation_log where action = 'ORDER_COMPLETE' and object_id = ? and request_id = 'merchant-pickup-duplicate'",
            Integer.class,
            orderNo
        )).isEqualTo(1);
    }

    private void prepareForPickup() {
        adminOrders.accept(orderNo, cashier, "setup-accept");
        adminOrders.markReady(orderNo, cashier, "setup-ready");
    }

    private OrderStatus orderStatus() {
        return OrderStatus.valueOf(jdbcTemplate.queryForObject(
            "select status from customer_order where order_no = ?",
            String.class,
            orderNo
        ));
    }

    private CurrentPrincipal merchantPrincipal(long id, String role, String sessionId) {
        return new CurrentPrincipal(id, ActorType.STAFF, role, sessionId, ClientType.MERCHANT_MINI);
    }

    private String token(CurrentPrincipal principal) {
        redisTemplate.opsForValue().set(
            "auth:session:" + principal.sessionId(),
            Long.toString(principal.id())
        );
        redisTemplate.opsForValue().set(
            "auth:merchant-staff:" + principal.id(),
            principal.sessionId()
        );
        return jwtService.issue(principal);
    }
}
