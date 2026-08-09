package com.luneng.smartstore.common.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.luneng.smartstore.auth.ActorType;
import com.luneng.smartstore.auth.CurrentPrincipal;
import com.luneng.smartstore.common.api.ApiResponse;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Clock;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class RateLimitFilter extends OncePerRequestFilter {
    private static final Logger LOGGER = LoggerFactory.getLogger(RateLimitFilter.class);
    private static final DefaultRedisScript<Long> SLIDING_WINDOW_SCRIPT =
        new DefaultRedisScript<>(
            """
            local now = tonumber(ARGV[1])
            local window = tonumber(ARGV[2])
            local limit = tonumber(ARGV[3])
            redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now - window)
            local count = redis.call('ZCARD', KEYS[1])
            if count >= limit then
                return 0
            end
            redis.call('ZADD', KEYS[1], now, ARGV[4])
            redis.call('PEXPIRE', KEYS[1], window)
            return 1
            """,
            Long.class
        );

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;
    private final Limit staffLogin;
    private final Limit customerLogin;
    private final Limit orderCreate;
    private final Clock clock;

    @Autowired
    public RateLimitFilter(
        StringRedisTemplate redisTemplate,
        ObjectMapper objectMapper,
        @Value("${smart-store.rate-limit.staff-login.limit:10}") int staffLoginLimit,
        @Value("${smart-store.rate-limit.staff-login.window-seconds:600}")
        long staffLoginWindow,
        @Value("${smart-store.rate-limit.customer-login.limit:30}") int customerLoginLimit,
        @Value("${smart-store.rate-limit.customer-login.window-seconds:600}")
        long customerLoginWindow,
        @Value("${smart-store.rate-limit.order-create.limit:10}") int orderCreateLimit,
        @Value("${smart-store.rate-limit.order-create.window-seconds:60}")
        long orderCreateWindow
    ) {
        this(
            redisTemplate,
            objectMapper,
            staffLoginLimit,
            staffLoginWindow,
            customerLoginLimit,
            customerLoginWindow,
            orderCreateLimit,
            orderCreateWindow,
            Clock.systemUTC()
        );
    }

    RateLimitFilter(
        StringRedisTemplate redisTemplate,
        ObjectMapper objectMapper,
        int staffLoginLimit,
        long staffLoginWindow,
        int customerLoginLimit,
        long customerLoginWindow,
        int orderCreateLimit,
        long orderCreateWindow,
        Clock clock
    ) {
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper;
        this.staffLogin = new Limit(staffLoginLimit, Duration.ofSeconds(staffLoginWindow));
        this.customerLogin = new Limit(customerLoginLimit, Duration.ofSeconds(customerLoginWindow));
        this.orderCreate = new Limit(orderCreateLimit, Duration.ofSeconds(orderCreateWindow));
        this.clock = clock;
    }

    @Override
    protected void doFilterInternal(
        HttpServletRequest request,
        HttpServletResponse response,
        FilterChain filterChain
    ) throws ServletException, IOException {
        Rule rule = rule(request);
        if (rule == null) {
            filterChain.doFilter(request, response);
            return;
        }
        try {
            if (!allow(rule)) {
                reject(request, response, "请求过于频繁，请稍后再试");
                return;
            }
        } catch (RuntimeException exception) {
            if (rule.failClosed()) {
                LOGGER.warn("Login rate limiter unavailable; failing closed", exception);
                reject(request, response, "登录保护暂不可用，请稍后再试");
                return;
            }
            LOGGER.warn(
                "Order rate limiter unavailable; continuing with MySQL idempotency",
                exception
            );
        }
        filterChain.doFilter(request, response);
    }

    private Rule rule(HttpServletRequest request) {
        if (!"POST".equals(request.getMethod())) {
            return null;
        }
        return switch (request.getRequestURI()) {
            case "/api/admin/auth/login" ->
                new Rule("staff-login", request.getRemoteAddr(), staffLogin, true);
            case "/api/merchant-mini/auth/password-login" ->
                new Rule("merchant-password-login", request.getRemoteAddr(), staffLogin, true);
            case "/api/mini/auth/wechat" ->
                new Rule("customer-login", request.getRemoteAddr(), customerLogin, true);
            case "/api/mini/orders" -> orderRule();
            default -> null;
        };
    }

    private Rule orderRule() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null
            || !(authentication.getPrincipal() instanceof CurrentPrincipal principal)
            || principal.actorType() != ActorType.CUSTOMER) {
            return null;
        }
        return new Rule(
            "order-create",
            Long.toString(principal.id()),
            orderCreate,
            true
        );
    }

    private boolean allow(Rule rule) {
        String key = "rate-limit:v2:%s:%s".formatted(
            rule.scope(),
            rule.identity()
        );
        long nowMillis = clock.millis();
        Long allowed = redisTemplate.execute(
            SLIDING_WINDOW_SCRIPT,
            List.of(key),
            Long.toString(nowMillis),
            Long.toString(rule.limit().window().toMillis()),
            Integer.toString(rule.limit().requests()),
            nowMillis + ":" + UUID.randomUUID()
        );
        return Long.valueOf(1L).equals(allowed);
    }

    private void reject(
        HttpServletRequest request,
        HttpServletResponse response,
        String message
    ) throws IOException {
        String requestId = RequestIdFilter.requestId(request);
        response.setStatus(429);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setHeader(RequestIdFilter.HEADER, requestId);
        objectMapper.writeValue(
            response.getOutputStream(),
            ApiResponse.error("RATE_LIMITED", message, requestId)
        );
    }

    private record Limit(int requests, Duration window) {
        private Limit {
            if (requests <= 0 || window.isZero() || window.isNegative()) {
                throw new IllegalArgumentException("Rate limit configuration must be positive");
            }
        }
    }

    private record Rule(String scope, String identity, Limit limit, boolean failClosed) {
    }
}
