package com.luneng.smartstore.customer;

import com.luneng.smartstore.auth.ActorType;
import com.luneng.smartstore.auth.CurrentPrincipal;
import com.luneng.smartstore.auth.JwtService;
import com.luneng.smartstore.common.api.BusinessException;
import java.util.UUID;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CustomerAuthService {
    private final WechatSessionClient wechatSessionClient;
    private final CustomerUserRepository repository;
    private final StringRedisTemplate redisTemplate;
    private final JwtService jwtService;

    public CustomerAuthService(
        WechatSessionClient wechatSessionClient,
        CustomerUserRepository repository,
        StringRedisTemplate redisTemplate,
        JwtService jwtService
    ) {
        this.wechatSessionClient = wechatSessionClient;
        this.repository = repository;
        this.redisTemplate = redisTemplate;
        this.jwtService = jwtService;
    }

    @Transactional
    public LoginResult login(String code) {
        WechatSessionClient.WechatSession wechatSession = wechatSessionClient.exchange(code);
        CustomerUser customer = repository.findByOpenid(wechatSession.openid())
            .orElseGet(() -> repository.save(new CustomerUser(wechatSession.openid())));
        if (!customer.isEnabled()) {
            throw new BusinessException(
                "ACCOUNT_DISABLED",
                "账号已停用",
                HttpStatus.FORBIDDEN
            );
        }

        String sessionId = UUID.randomUUID().toString();
        redisTemplate.opsForValue().set(
            "auth:session:" + sessionId,
            Long.toString(customer.getId()),
            JwtService.TOKEN_TTL
        );
        String customerSessionsKey = "auth:customer-sessions:" + customer.getId();
        redisTemplate.opsForSet().add(customerSessionsKey, sessionId);
        redisTemplate.expire(customerSessionsKey, JwtService.TOKEN_TTL);
        String accessToken = jwtService.issue(new CurrentPrincipal(
            customer.getId(),
            ActorType.CUSTOMER,
            "CUSTOMER",
            sessionId
        ));
        return new LoginResult(accessToken, customer.profileComplete());
    }

    public record LoginResult(String accessToken, boolean profileComplete) {
    }
}
