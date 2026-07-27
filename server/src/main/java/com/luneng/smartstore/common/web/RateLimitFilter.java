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
import java.time.Duration;
import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class RateLimitFilter extends OncePerRequestFilter {
    private static final Logger LOGGER = LoggerFactory.getLogger(RateLimitFilter.class);

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;
    private final Limit staffLogin;
    private final Limit customerLogin;
    private final Limit orderCreate;

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
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper;
        this.staffLogin = new Limit(staffLoginLimit, Duration.ofSeconds(staffLoginWindow));
        this.customerLogin = new Limit(customerLoginLimit, Duration.ofSeconds(customerLoginWindow));
        this.orderCreate = new Limit(orderCreateLimit, Duration.ofSeconds(orderCreateWindow));
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
            false
        );
    }

    private boolean allow(Rule rule) {
        long bucket = Instant.now().getEpochSecond() / rule.limit().window().toSeconds();
        String key = "rate-limit:%s:%s:%d".formatted(
            rule.scope(),
            rule.identity(),
            bucket
        );
        Long count = redisTemplate.opsForValue().increment(key);
        if (count != null && count == 1L) {
            redisTemplate.expire(key, rule.limit().window().plusSeconds(1));
        }
        return count != null && count <= rule.limit().requests();
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
