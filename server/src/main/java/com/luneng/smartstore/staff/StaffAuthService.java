package com.luneng.smartstore.staff;

import com.luneng.smartstore.auth.ActorType;
import com.luneng.smartstore.auth.CurrentPrincipal;
import com.luneng.smartstore.auth.JwtService;
import com.luneng.smartstore.common.api.BusinessException;
import java.time.Instant;
import java.util.UUID;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class StaffAuthService {
    private final StaffAccountRepository repository;
    private final PasswordEncoder passwordEncoder;
    private final StringRedisTemplate redisTemplate;
    private final JwtService jwtService;

    public StaffAuthService(
        StaffAccountRepository repository,
        PasswordEncoder passwordEncoder,
        StringRedisTemplate redisTemplate,
        JwtService jwtService
    ) {
        this.repository = repository;
        this.passwordEncoder = passwordEncoder;
        this.redisTemplate = redisTemplate;
        this.jwtService = jwtService;
    }

    @Transactional
    public LoginResult login(String username, String rawPassword) {
        StaffAccount account = repository.findByUsernameAndEnabledTrue(username)
            .orElseThrow(this::invalidCredentials);
        if (!passwordEncoder.matches(rawPassword, account.getPasswordHash())) {
            throw invalidCredentials();
        }

        String sessionId = UUID.randomUUID().toString();
        redisTemplate.opsForValue().set(
            "auth:session:" + sessionId,
            Long.toString(account.getId()),
            JwtService.TOKEN_TTL
        );
        account.recordLogin(Instant.now());
        String token = jwtService.issue(new CurrentPrincipal(
            account.getId(),
            ActorType.STAFF,
            account.getRole(),
            sessionId
        ));
        return new LoginResult(token, account.getRole());
    }

    private BusinessException invalidCredentials() {
        return new BusinessException(
            "INVALID_CREDENTIALS",
            "用户名或密码错误",
            HttpStatus.UNAUTHORIZED
        );
    }

    public record LoginResult(String accessToken, String role) {
    }
}
