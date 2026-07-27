package com.luneng.smartstore.common.web;

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
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

@AutoConfigureMockMvc
class RateLimitFilterTest extends IntegrationTestBase {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private StringRedisTemplate redisTemplate;

    private String token;

    @BeforeEach
    void setUp() {
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
            "insert into customer_user(id, openid, enabled) values (1, 'limited-customer', true)"
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
            "insert into online_inventory(product_id, available_quantity, version) values (10, 20, 0)"
        );
        String sessionId = "rate-limit-session";
        redisTemplate.opsForValue().set("auth:session:" + sessionId, "1");
        token = jwtService.issue(new CurrentPrincipal(
            1L, ActorType.CUSTOMER, "CUSTOMER", sessionId
        ));
    }

    @Test
    void orderRateLimitReturnsTooManyRequests() throws Exception {
        for (int i = 0; i < 10; i++) {
            performCreateOrder("key-" + i)
                .andExpect(status().isOk());
        }

        performCreateOrder("key-over-limit")
            .andExpect(status().isTooManyRequests())
            .andExpect(jsonPath("$.code").value("RATE_LIMITED"));
    }

    private org.springframework.test.web.servlet.ResultActions performCreateOrder(String key)
        throws Exception {
        return mockMvc.perform(post("/api/mini/orders")
            .header("Authorization", "Bearer " + token)
            .header("Idempotency-Key", key)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "pickupName":"顾客",
                  "phone":"13800138000",
                  "items":[{"productId":10,"quantity":1}]
                }
                """));
    }
}
