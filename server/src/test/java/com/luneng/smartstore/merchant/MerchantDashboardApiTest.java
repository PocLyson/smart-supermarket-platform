package com.luneng.smartstore.merchant;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.luneng.smartstore.auth.ActorType;
import com.luneng.smartstore.auth.ClientType;
import com.luneng.smartstore.auth.CurrentPrincipal;
import com.luneng.smartstore.auth.JwtService;
import com.luneng.smartstore.support.IntegrationTestBase;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

@AutoConfigureMockMvc
class MerchantDashboardApiTest extends IntegrationTestBase {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private StringRedisTemplate redisTemplate;

    private String cashierToken;

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
            "insert into customer_user(id, openid, enabled) values (1, 'dashboard-owner', true)"
        );
        jdbcTemplate.update(
            "insert into category(id, name, sort_order, enabled) values (1, 'Dashboard', 1, true)"
        );
        for (int productId = 10; productId <= 13; productId++) {
            jdbcTemplate.update(
                "insert into product(id, category_id, name, price_cent, unit, on_shelf) values (?, 1, ?, 100, 'item', true)",
                productId,
                "Product " + productId
            );
        }
        jdbcTemplate.update(
            "insert into online_inventory(product_id, available_quantity, version) values (10, 0, 0), (11, 1, 0), (12, 5, 0), (13, 6, 0)"
        );
        insertOrder("DASH-OLD", "PENDING_CONFIRMATION", 30);
        insertOrder("DASH-MIDDLE", "READY_FOR_PICKUP", 20);
        insertOrder("DASH-LATEST", "CANCELLED", 10);

        CurrentPrincipal cashier = new CurrentPrincipal(
            9L,
            ActorType.STAFF,
            "CASHIER",
            "dashboard-cashier-session",
            ClientType.MERCHANT_MINI
        );
        redisTemplate.opsForValue().set("auth:session:" + cashier.sessionId(), "9");
        redisTemplate.opsForValue().set("auth:merchant-staff:9", cashier.sessionId());
        cashierToken = jwtService.issue(cashier);
    }

    @Test
    void dashboardReturnsOrderCountsLowStockWaitingConversationsAndLatestOrders() throws Exception {
        mockMvc.perform(get("/api/merchant-mini/dashboard")
                .header("Authorization", "Bearer " + cashierToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.orderCounts.PENDING_CONFIRMATION").value(1))
            .andExpect(jsonPath("$.data.orderCounts.PREPARING").value(0))
            .andExpect(jsonPath("$.data.orderCounts.READY_FOR_PICKUP").value(1))
            .andExpect(jsonPath("$.data.orderCounts.COMPLETED").value(0))
            .andExpect(jsonPath("$.data.orderCounts.CANCELLED").value(1))
            .andExpect(jsonPath("$.data.lowStockCount").value(2))
            .andExpect(jsonPath("$.data.waitingConversationCount").value(0))
            .andExpect(jsonPath("$.data.latestOrders[0].orderNo").value("DASH-LATEST"))
            .andExpect(jsonPath("$.data.latestOrders[1].orderNo").value("DASH-MIDDLE"))
            .andExpect(jsonPath("$.data.latestOrders[2].orderNo").value("DASH-OLD"));
    }

    private void insertOrder(String orderNo, String status, int minutesAgo) {
        jdbcTemplate.update(
            """
            insert into customer_order(
                order_no, customer_id, idempotency_key, pickup_code, pickup_name, phone,
                total_cent, status, payment_status, created_at
            ) values (?, 1, ?, '456789', 'Customer', '13800138000', 100, ?, 'UNPAID', timestampadd(minute, ?, current_timestamp(6)))
            """,
            orderNo,
            "key-" + orderNo,
            status,
            -minutesAgo
        );
    }
}
