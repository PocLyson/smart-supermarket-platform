package com.luneng.smartstore.auth;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.luneng.smartstore.support.IntegrationTestBase;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

@AutoConfigureMockMvc
class ClientTypeSecurityTest extends IntegrationTestBase {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private StringRedisTemplate redisTemplate;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setUpStaff() {
        jdbcTemplate.update("delete from staff_wechat_binding");
        jdbcTemplate.update("delete from staff_account");
        jdbcTemplate.update(
            "insert into staff_account(id, username, password_hash, role, enabled) values (42, 'cashier', 'hash', 'CASHIER', true)"
        );
    }

    @Test
    void merchantAccountRejectsAdminAndCustomerTokensButAllowsMerchantToken() throws Exception {
        String adminToken = tokenFor(ActorType.STAFF, "OWNER", ClientType.ADMIN_WEB);
        String customerToken = tokenFor(ActorType.CUSTOMER, "CUSTOMER", ClientType.CUSTOMER_MINI);
        String merchantToken = tokenFor(ActorType.STAFF, "CASHIER", ClientType.MERCHANT_MINI);

        mockMvc.perform(get("/api/merchant-mini/account")
                .header("Authorization", "Bearer " + adminToken))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("FORBIDDEN"));
        mockMvc.perform(get("/api/merchant-mini/account")
                .header("Authorization", "Bearer " + customerToken))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("FORBIDDEN"));
        mockMvc.perform(get("/api/merchant-mini/account")
                .header("Authorization", "Bearer " + merchantToken))
            .andExpect(status().isOk());
    }

    private String tokenFor(ActorType actorType, String role, ClientType clientType) {
        String sessionId = UUID.randomUUID().toString();
        redisTemplate.opsForValue().set("auth:session:" + sessionId, "42");
        return jwtService.issue(new CurrentPrincipal(42L, actorType, role, sessionId, clientType));
    }
}
