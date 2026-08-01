package com.luneng.smartstore.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.luneng.smartstore.common.api.ApiResponse;
import com.luneng.smartstore.common.web.RateLimitFilter;
import com.luneng.smartstore.common.web.RequestIdFilter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
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
                ).hasRole("OWNER")
                .requestMatchers("/api/admin/**").hasAnyRole("OWNER", "CASHIER")
                .requestMatchers(
                    "/api/mini/account",
                    "/api/mini/profile",
                    "/api/mini/orders/**"
                ).hasRole("CUSTOMER")
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
}
