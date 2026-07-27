package com.luneng.smartstore.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.luneng.smartstore.common.api.ApiResponse;
import com.luneng.smartstore.common.web.RequestIdFilter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
public class SecurityConfig {
    @Bean
    SecurityFilterChain securityFilterChain(
        HttpSecurity http,
        JwtAuthenticationFilter jwtAuthenticationFilter,
        ObjectMapper objectMapper
    ) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
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
                    "/api/mini/products/**"
                ).permitAll()
                .requestMatchers(
                    "/api/admin/staff/**",
                    "/api/admin/audit-logs/**",
                    "/api/admin/security-test/owner-only"
                ).hasRole("OWNER")
                .requestMatchers("/api/admin/**").hasAnyRole("OWNER", "CASHIER")
                .requestMatchers("/api/mini/profile", "/api/mini/orders/**").hasRole("CUSTOMER")
                .anyRequest().authenticated()
            )
            .exceptionHandling(exceptions -> exceptions
                .authenticationEntryPoint((request, response, exception) ->
                    writeError(objectMapper, request, response, 401, "UNAUTHORIZED", "请先登录"))
                .accessDeniedHandler((request, response, exception) ->
                    writeError(objectMapper, request, response, 403, "FORBIDDEN", "无权执行该操作"))
            )
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
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
