package com.luneng.smartstore.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.luneng.smartstore.support.IntegrationTestBase;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
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

    @Test
    void merchantTokenCannotUseAdminEndpoints() throws Exception {
        String merchantOwnerToken = tokenFor(ActorType.STAFF, "OWNER", ClientType.MERCHANT_MINI);

        mockMvc.perform(get("/api/admin/staff")
                .header("Authorization", "Bearer " + merchantOwnerToken))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    void legacyTokensWithoutClientTypeKeepTheirOriginalClientScope() {
        CurrentPrincipal legacyAdmin = jwtService.parse(legacyToken(ActorType.STAFF, "OWNER"));
        CurrentPrincipal legacyCustomer = jwtService.parse(legacyToken(ActorType.CUSTOMER, "CUSTOMER"));

        assertThat(legacyAdmin.clientType()).isEqualTo(ClientType.ADMIN_WEB);
        assertThat(legacyCustomer.clientType()).isEqualTo(ClientType.CUSTOMER_MINI);
    }

    private String tokenFor(ActorType actorType, String role, ClientType clientType) {
        String sessionId = UUID.randomUUID().toString();
        redisTemplate.opsForValue().set("auth:session:" + sessionId, "42");
        return jwtService.issue(new CurrentPrincipal(42L, actorType, role, sessionId, clientType));
    }

    private String legacyToken(ActorType actorType, String role) {
        String sessionId = UUID.randomUUID().toString();
        redisTemplate.opsForValue().set("auth:session:" + sessionId, "42");
        Instant now = Instant.now();
        String header = base64Url("{\"alg\":\"HS256\",\"typ\":\"JWT\"}");
        String payload = base64Url("""
            {"sub":"42","iat":%d,"exp":%d,"actorType":"%s","role":"%s","sessionId":"%s"}
            """.formatted(now.getEpochSecond(), now.plusSeconds(3600).getEpochSecond(), actorType, role, sessionId));
        String signingInput = header + "." + payload;
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(
                "test-only-secret-with-at-least-32-bytes".getBytes(StandardCharsets.UTF_8),
                "HmacSHA256"
            ));
            return signingInput + "." + Base64.getUrlEncoder().withoutPadding()
                .encodeToString(mac.doFinal(signingInput.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
    }

    private String base64Url(String value) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(value.getBytes(StandardCharsets.UTF_8));
    }
}
