package com.luneng.smartstore.auth;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    private static final String PREFIX = "Bearer ";

    private final JwtService jwtService;
    private final StringRedisTemplate redisTemplate;
    private final MerchantSessionStore merchantSessionStore;

    public JwtAuthenticationFilter(
        JwtService jwtService,
        StringRedisTemplate redisTemplate,
        MerchantSessionStore merchantSessionStore
    ) {
        this.jwtService = jwtService;
        this.redisTemplate = redisTemplate;
        this.merchantSessionStore = merchantSessionStore;
    }

    @Override
    protected void doFilterInternal(
        HttpServletRequest request,
        HttpServletResponse response,
        FilterChain filterChain
    ) throws ServletException, IOException {
        String authorization = request.getHeader("Authorization");
        if (StringUtils.hasText(authorization) && authorization.startsWith(PREFIX)) {
            authenticate(authorization.substring(PREFIX.length()));
        }
        filterChain.doFilter(request, response);
    }

    private void authenticate(String token) {
        try {
            CurrentPrincipal principal = jwtService.parse(token);
            if (!sessionIsValid(principal)) {
                return;
            }
            List<SimpleGrantedAuthority> authorities = principal.actorType() == ActorType.STAFF
                ? List.of(
                    new SimpleGrantedAuthority("ROLE_" + principal.role()),
                    new SimpleGrantedAuthority("CLIENT_" + principal.clientType().name())
                )
                : List.of(
                    new SimpleGrantedAuthority("ROLE_CUSTOMER"),
                    new SimpleGrantedAuthority("CLIENT_" + principal.clientType().name())
                );
            SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(principal, token, authorities)
            );
        } catch (JwtException | IllegalArgumentException ignored) {
            SecurityContextHolder.clearContext();
        }
    }

    private boolean sessionIsValid(CurrentPrincipal principal) {
        if (principal.clientType() == ClientType.MERCHANT_MINI) {
            return merchantSessionStore.isCurrent(principal.id(), principal.sessionId());
        }
        String session = redisTemplate.opsForValue()
            .get("auth:session:" + principal.sessionId());
        return Long.toString(principal.id()).equals(session);
    }
}
