package com.luneng.smartstore.common.web;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.luneng.smartstore.auth.ActorType;
import com.luneng.smartstore.auth.CurrentPrincipal;
import com.luneng.smartstore.auth.JwtService;
import com.luneng.smartstore.support.IntegrationTestBase;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.LockSupport;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.data.redis.connection.DataType;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
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
    void atomicOperationFailureFailsClosedWithoutLeavingPermanentCounterForEveryLimitedRoute()
        throws Exception {
        StringRedisTemplate unavailableRedis = mock(StringRedisTemplate.class);
        ValueOperations<String, String> values = mock(ValueOperations.class);
        when(unavailableRedis.opsForValue()).thenReturn(values);
        when(values.increment(anyString())).thenAnswer(invocation ->
            redisTemplate.opsForValue().increment(invocation.getArgument(0, String.class))
        );
        when(unavailableRedis.expire(anyString(), any(Duration.class)))
            .thenThrow(new IllegalStateException("expire unavailable"));
        when(unavailableRedis.execute(
            any(RedisScript.class),
            anyList(),
            any(Object[].class)
        )).thenThrow(new IllegalStateException("redis script unavailable"));
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
        List<LimitedRoute> routes = List.of(
            new LimitedRoute("/api/admin/auth/login", "198.51.100.6", null),
            new LimitedRoute("/api/merchant-mini/auth/password-login", "198.51.100.9", null),
            new LimitedRoute("/api/mini/auth/wechat", "198.51.100.10", null),
            new LimitedRoute("/api/mini/orders", "198.51.100.11", 4343L)
        );

        for (LimitedRoute route : routes) {
            clearRateLimitKeys();
            authenticateCustomer(route.customerId());
            try {
                MockHttpServletRequest request = new MockHttpServletRequest("POST", route.uri());
                request.setRemoteAddr(route.remoteAddress());
                MockHttpServletResponse response = new MockHttpServletResponse();
                filter.doFilter(request, response, new MockFilterChain());

                assertThat(response.getStatus()).as(route.uri()).isEqualTo(429);
                assertThat(response.getContentAsString())
                    .as(route.uri())
                    .contains("\"code\":\"RATE_LIMITED\"");
                assertThat(redisTemplate.keys("rate-limit:*")).as(route.uri()).isEmpty();
            } finally {
                SecurityContextHolder.clearContext();
            }
        }
    }

    @Test
    void slidingWindowPreventsNearDoubleBurstAcrossEveryLimitedRoute() throws Exception {
        RateLimitFilter filter = oneSecondFilter(redisTemplate);
        List<LimitedRoute> routes = List.of(
            new LimitedRoute("/api/admin/auth/login", "198.51.100.21", null),
            new LimitedRoute("/api/merchant-mini/auth/password-login", "198.51.100.22", null),
            new LimitedRoute("/api/mini/auth/wechat", "198.51.100.23", null),
            new LimitedRoute("/api/mini/orders", "198.51.100.24", 4242L)
        );

        for (LimitedRoute route : routes) {
            clearRateLimitKeys();
            authenticateCustomer(route.customerId());
            try {
                assertThat(directStatus(filter, route)).as(route.uri()).isEqualTo(200);
                String key = onlyRateLimitKey();
                Long initialTtlMillis = redisTemplate.getExpire(key, TimeUnit.MILLISECONDS);
                assertThat(initialTtlMillis).as(route.uri()).isNotNull().isPositive();
                long observedAt = System.nanoTime();
                long originalExpiry = observedAt
                    + TimeUnit.MILLISECONDS.toNanos(initialTtlMillis);

                waitUntil(originalExpiry - TimeUnit.MILLISECONDS.toNanos(350));
                for (int attempt = 1; attempt < 10; attempt++) {
                    assertThat(directStatus(filter, route)).as(route.uri()).isEqualTo(200);
                }

                waitUntil(originalExpiry + TimeUnit.MILLISECONDS.toNanos(100));
                int allowedAfterOriginalExpiry = 0;
                for (int attempt = 0; attempt < 10; attempt++) {
                    if (directStatus(filter, route) == 200) {
                        allowedAfterOriginalExpiry++;
                    }
                }
                assertThat(allowedAfterOriginalExpiry)
                    .as("accepted burst after original window boundary for %s", route.uri())
                    .isEqualTo(1);
            } finally {
                SecurityContextHolder.clearContext();
            }
        }
    }

    @Test
    void concurrentRequestsPersistOneExpiringZsetEntryPerAcceptedRequest() throws Exception {
        RateLimitFilter filter = new RateLimitFilter(
            redisTemplate,
            new com.fasterxml.jackson.databind.ObjectMapper(),
            10,
            60,
            10,
            60,
            10,
            60,
            Clock.fixed(Instant.ofEpochMilli(1_900_000_000_000L), ZoneOffset.UTC)
        );
        LimitedRoute route = new LimitedRoute(
            "/api/admin/auth/login",
            "198.51.100.25",
            null
        );
        int requestCount = 32;
        CountDownLatch ready = new CountDownLatch(requestCount);
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(requestCount);
        try {
            List<Future<Integer>> results = java.util.stream.IntStream.range(0, requestCount)
                .mapToObj(ignored -> executor.submit(() -> {
                    ready.countDown();
                    start.await();
                    return directStatus(filter, route);
                }))
                .toList();
            assertThat(ready.await(5, TimeUnit.SECONDS)).isTrue();
            start.countDown();

            int allowed = 0;
            for (Future<Integer> result : results) {
                if (result.get(5, TimeUnit.SECONDS) == 200) {
                    allowed++;
                }
            }

            assertThat(allowed).isEqualTo(10);
            String key = onlyRateLimitKey();
            assertThat(redisTemplate.type(key)).isEqualTo(DataType.ZSET);
            assertThat(redisTemplate.opsForZSet().zCard(key)).isEqualTo(10L);
            assertThat(redisTemplate.getExpire(key, TimeUnit.MILLISECONDS)).isPositive();
        } finally {
            start.countDown();
            executor.shutdownNow();
        }
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

    private RateLimitFilter oneSecondFilter(StringRedisTemplate template) {
        return new RateLimitFilter(
            template,
            new com.fasterxml.jackson.databind.ObjectMapper(),
            10,
            1,
            10,
            1,
            10,
            1
        );
    }

    private int directStatus(RateLimitFilter filter, LimitedRoute route) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", route.uri());
        request.setRemoteAddr(route.remoteAddress());
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, new MockFilterChain());
        return response.getStatus();
    }

    private void authenticateCustomer(Long customerId) {
        SecurityContextHolder.clearContext();
        if (customerId == null) {
            return;
        }
        CurrentPrincipal principal = new CurrentPrincipal(
            customerId,
            ActorType.CUSTOMER,
            "CUSTOMER",
            "rate-limit-boundary-session"
        );
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(principal, null, List.of())
        );
    }

    private String onlyRateLimitKey() {
        var keys = redisTemplate.keys("rate-limit:*");
        assertThat(keys).hasSize(1);
        return keys.iterator().next();
    }

    private void clearRateLimitKeys() {
        var keys = redisTemplate.keys("rate-limit:*");
        if (!keys.isEmpty()) {
            redisTemplate.delete(keys);
        }
    }

    private void waitUntil(long targetNanos) {
        while (true) {
            long remaining = targetNanos - System.nanoTime();
            if (remaining <= 0) {
                return;
            }
            LockSupport.parkNanos(Math.min(remaining, TimeUnit.MILLISECONDS.toNanos(10)));
        }
    }

    private record LimitedRoute(String uri, String remoteAddress, Long customerId) {
    }
}
