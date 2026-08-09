package com.luneng.smartstore.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.luneng.smartstore.common.api.ApiResponse;
import com.luneng.smartstore.common.web.RateLimitFilter;
import com.luneng.smartstore.common.web.RequestIdFilter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Arrays;
import java.util.List;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.authorization.AuthorizationDecision;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.beans.factory.annotation.Value;

@Configuration
public class SecurityConfig {
    @Bean
    SecurityFilterChain securityFilterChain(
        HttpSecurity http,
        JwtAuthenticationFilter jwtAuthenticationFilter,
        RateLimitFilter rateLimitFilter,
        CorsConfigurationSource corsConfigurationSource,
        ObjectMapper objectMapper
    ) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .cors(cors -> cors.configurationSource(corsConfigurationSource))
            .sessionManagement(session ->
                session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(authorize -> authorize
                .requestMatchers(
                    "/actuator/health",
                    "/files/**",
                    "/api/admin/auth/login",
                    "/api/mini/auth/wechat",
                    "/api/merchant-mini/auth/password-login",
                    "/api/merchant-mini/auth/wechat-login",
                    "/api/mini/categories",
                    "/api/mini/products",
                    "/api/mini/products/**",
                    "/api/mini/announcements",
                    "/api/mini/announcements/**",
                    "/api/mini/store/contact"
                ).permitAll()
                .requestMatchers(
                    "/api/admin/announcements/**",
                    "/api/admin/staff/**",
                    "/api/admin/audit-logs/**",
                    "/api/admin/categories/**",
                    "/api/admin/products/**",
                    "/api/admin/inventory/**",
                    "/api/admin/files/**",
                    "/api/admin/security-test/owner-only"
                ).access((authentication, context) -> hasClientAndAnyRole(
                    authentication.get(), "CLIENT_ADMIN_WEB", "ROLE_OWNER"
                ))
                .requestMatchers("/api/admin/**").access((authentication, context) -> hasClientAndAnyRole(
                    authentication.get(), "CLIENT_ADMIN_WEB", "ROLE_OWNER", "ROLE_CASHIER"
                ))
                .requestMatchers(
                    "/api/mini/account",
                    "/api/mini/profile",
                    "/api/mini/orders/**"
                ).hasRole("CUSTOMER")
                .requestMatchers("/api/merchant-mini/**").access((authentication, context) -> hasClientAndAnyRole(
                    authentication.get(), "CLIENT_MERCHANT_MINI", "ROLE_OWNER", "ROLE_CASHIER"
                ))
                .anyRequest().authenticated()
            )
            .exceptionHandling(exceptions -> exceptions
                .authenticationEntryPoint((request, response, exception) ->
                    writeError(objectMapper, request, response, 401, "UNAUTHORIZED", "请先登录"))
                .accessDeniedHandler((request, response, exception) ->
                    writeError(objectMapper, request, response, 403, "FORBIDDEN", "无权执行该操作"))
            )
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
            .addFilterAfter(rateLimitFilter, JwtAuthenticationFilter.class);
        return http.build();
    }

    @Bean
    FilterRegistrationBean<RateLimitFilter> rateLimitFilterRegistration(
        RateLimitFilter filter
    ) {
        FilterRegistrationBean<RateLimitFilter> registration =
            new FilterRegistrationBean<>(filter);
        registration.setEnabled(false);
        return registration;
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource(
        @Value("${smart-store.cors.allowed-origins:http://localhost:5173,http://127.0.0.1:5173}")
        List<String> allowedOrigins
    ) {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(allowedOrigins);
        configuration.setAllowedMethods(List.of(
            "GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"
        ));
        configuration.setAllowedHeaders(List.of("Authorization", "Content-Type"));
        configuration.setExposedHeaders(List.of("X-Request-Id"));
        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", configuration);
        return source;
    }

    private static void writeError(
        ObjectMapper objectMapper,
        HttpServletRequest request,
        HttpServletResponse response,
        int status,
        String code,
        String message
    ) throws IOException {
        response.setStatus(status);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        objectMapper.writeValue(
            response.getOutputStream(),
            ApiResponse.error(code, message, RequestIdFilter.requestId(request))
        );
    }

    private static AuthorizationDecision hasClientAndAnyRole(
        Authentication authentication,
        String clientAuthority,
        String... roleAuthorities
    ) {
        List<String> grantedAuthorities = authentication.getAuthorities().stream()
            .map(authority -> authority.getAuthority())
            .toList();
        return new AuthorizationDecision(
            grantedAuthorities.contains(clientAuthority)
                && Arrays.stream(roleAuthorities).anyMatch(grantedAuthorities::contains)
        );
    }
}
