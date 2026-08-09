package com.luneng.smartstore.common.web;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.luneng.smartstore.auth.ActorType;
import com.luneng.smartstore.auth.CurrentPrincipal;
import com.luneng.smartstore.auth.JwtService;
import com.luneng.smartstore.support.IntegrationTestBase;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
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
        var rateLimitKeys = redisTemplate.keys("rate-limit:*");
        if (!rateLimitKeys.isEmpty()) {
            redisTemplate.delete(rateLimitKeys);
        }
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
    void merchantPasswordLoginSharesFailClosedStaffLoginLimit() throws Exception {
        for (int attempt = 0; attempt < 10; attempt++) {
            performMerchantPasswordLogin()
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
        }

        performMerchantPasswordLogin()
            .andExpect(status().isTooManyRequests())
            .andExpect(jsonPath("$.code").value("RATE_LIMITED"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void merchantPasswordLoginFailsClosedWhenRateLimitBackendIsUnavailable() throws Exception {
        StringRedisTemplate unavailableRedis = mock(StringRedisTemplate.class);
        ValueOperations<String, String> values = mock(ValueOperations.class);
        when(unavailableRedis.opsForValue()).thenReturn(values);
        when(values.increment(anyString())).thenThrow(new IllegalStateException("redis unavailable"));
        RateLimitFilter filter = new RateLimitFilter(
            unavailableRedis,
            new com.fasterxml.jackson.databind.ObjectMapper(),
            10,
            600,
            30,
            600,
            10,
            60
        );
        MockHttpServletRequest request = new MockHttpServletRequest(
            "POST",
            "/api/merchant-mini/auth/password-login"
        );
        request.setRemoteAddr("198.51.100.9");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, new MockFilterChain());

        assertThat(response.getStatus()).isEqualTo(429);
        assertThat(response.getContentAsString()).contains("\"code\":\"RATE_LIMITED\"");
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

    private org.springframework.test.web.servlet.ResultActions performMerchantPasswordLogin()
        throws Exception {
        return mockMvc.perform(post("/api/merchant-mini/auth/password-login")
            .with(request -> {
                request.setRemoteAddr("198.51.100.8");
                return request;
            })
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "username":"missing-staff",
                  "password":"wrong-password",
                  "code":"valid-wechat-code"
                }
                """));
    }
}
