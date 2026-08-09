package com.luneng.smartstore.merchantauth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.luneng.smartstore.support.IntegrationTestBase;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@AutoConfigureMockMvc
class MerchantAuthApiTest extends IntegrationTestBase {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private StringRedisTemplate redisTemplate;

    @Autowired
    private MerchantAuthService authService;

    @MockitoBean
    private MerchantWechatSessionClient merchantWechatSessionClient;

    @BeforeEach
    void setUpAccounts() {
        Set<String> redisKeys = redisTemplate.keys("auth:*");
        if (!redisKeys.isEmpty()) {
            redisTemplate.delete(redisKeys);
        }
        jdbcTemplate.update("delete from staff_wechat_binding");
        jdbcTemplate.update("delete from staff_account");
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
        insert("owner", encoder.encode("correct-password"), "OWNER", true);
        insert("cashier", encoder.encode("cashier-password"), "CASHIER", true);
    }

    @Test
    void passwordLoginFirstBindsWechatAndSameWechatRetryIsIdempotent() throws Exception {
        when(merchantWechatSessionClient.exchange("first-code"))
            .thenReturn(new MerchantWechatSessionClient.WechatSession("openid-1"));

        org.springframework.test.web.servlet.ResultActions firstLogin = passwordLogin(
            "owner", "correct-password", "first-code"
        );
        firstLogin.andExpect(status().isOk())
            .andExpect(jsonPath("$.data.role").value("OWNER"))
            .andExpect(jsonPath("$.data.staffId").isNumber())
            .andExpect(jsonPath("$.data.username").value("owner"))
            .andExpect(jsonPath("$.data.expiresAt").isNotEmpty());
        String firstToken = accessToken(firstLogin);
        Instant firstLoginAt = jdbcTemplate.queryForObject(
            "select last_login_at from staff_wechat_binding where openid = 'openid-1'",
            Instant.class
        );

        String secondToken = accessToken(passwordLogin("owner", "correct-password", "first-code"));

        assertThat(jdbcTemplate.queryForObject(
            "select count(*) from staff_wechat_binding where openid = 'openid-1'",
            Integer.class
        )).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject(
            "select last_login_at from staff_wechat_binding where openid = 'openid-1'",
            Instant.class
        )).isAfterOrEqualTo(firstLoginAt);
        mockMvc.perform(get("/api/merchant-mini/account")
                .header("Authorization", "Bearer " + firstToken))
            .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/merchant-mini/account")
                .header("Authorization", "Bearer " + secondToken))
            .andExpect(status().isOk());
    }

    @Test
    void passwordLoginRejectsDifferentWechatForAlreadyBoundStaff() throws Exception {
        when(merchantWechatSessionClient.exchange("first-code"))
            .thenReturn(new MerchantWechatSessionClient.WechatSession("openid-1"));
        when(merchantWechatSessionClient.exchange("second-code"))
            .thenReturn(new MerchantWechatSessionClient.WechatSession("openid-2"));
        passwordLogin("owner", "correct-password", "first-code").andExpect(status().isOk());

        passwordLogin("owner", "correct-password", "second-code")
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("STAFF_WECHAT_ALREADY_BOUND"))
            .andExpect(jsonPath("$.message").value("该员工账号已绑定其他微信，请先解绑"));
    }

    @Test
    void passwordLoginRejectsWechatAlreadyBoundToAnotherStaff() throws Exception {
        when(merchantWechatSessionClient.exchange("first-code"))
            .thenReturn(new MerchantWechatSessionClient.WechatSession("openid-1"));
        passwordLogin("owner", "correct-password", "first-code").andExpect(status().isOk());
        long ownerId = jdbcTemplate.queryForObject(
            "select id from staff_account where username = 'owner'", Long.class
        );

        passwordLogin("cashier", "cashier-password", "first-code")
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("WECHAT_ALREADY_BOUND"))
            .andExpect(jsonPath("$.message").value("该微信已绑定其他员工账号"));
    }

    @Test
    void disabledStaffCannotUsePasswordLogin() throws Exception {
        when(merchantWechatSessionClient.exchange("first-code"))
            .thenReturn(new MerchantWechatSessionClient.WechatSession("openid-1"));
        jdbcTemplate.update("update staff_account set enabled = false where username = 'owner'");

        passwordLogin("owner", "correct-password", "first-code")
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
    }

    @Test
    void wechatLoginUsesEnabledBindingAndRejectsUnboundWechat() throws Exception {
        when(merchantWechatSessionClient.exchange("first-code"))
            .thenReturn(new MerchantWechatSessionClient.WechatSession("openid-1"));
        passwordLogin("owner", "correct-password", "first-code").andExpect(status().isOk());

        mockMvc.perform(post("/api/merchant-mini/auth/wechat-login")
                .contentType(APPLICATION_JSON)
                .content("{\"code\":\"first-code\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.role").value("OWNER"))
            .andExpect(jsonPath("$.data.username").value("owner"));

        when(merchantWechatSessionClient.exchange("unbound-code"))
            .thenReturn(new MerchantWechatSessionClient.WechatSession("unbound-openid"));
        mockMvc.perform(post("/api/merchant-mini/auth/wechat-login")
                .contentType(APPLICATION_JSON)
                .content("{\"code\":\"unbound-code\"}"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("MERCHANT_NOT_BOUND"))
            .andExpect(jsonPath("$.message").value("该微信尚未绑定员工账号"));
    }

    @Test
    void logoutInvalidatesMerchantSessionAndRequiresMerchantToken() throws Exception {
        when(merchantWechatSessionClient.exchange("first-code"))
            .thenReturn(new MerchantWechatSessionClient.WechatSession("openid-1"));
        String token = accessToken(passwordLogin("owner", "correct-password", "first-code"));

        mockMvc.perform(post("/api/merchant-mini/auth/logout")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk());
        mockMvc.perform(get("/api/merchant-mini/account")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
        mockMvc.perform(post("/api/merchant-mini/auth/logout")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
        mockMvc.perform(post("/api/merchant-mini/auth/logout"))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    @Test
    void unbindInvalidatesCurrentMerchantSession() throws Exception {
        when(merchantWechatSessionClient.exchange("first-code"))
            .thenReturn(new MerchantWechatSessionClient.WechatSession("openid-1"));
        String token = accessToken(passwordLogin("owner", "correct-password", "first-code"));

        mockMvc.perform(delete("/api/merchant-mini/account/wechat-binding")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk());
        assertThat(jdbcTemplate.queryForObject(
            "select unbound_at is not null from staff_wechat_binding where openid = 'openid-1'",
            Boolean.class
        )).isTrue();
        mockMvc.perform(get("/api/merchant-mini/account")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void unboundStaffCanBindAnotherWechatAndReleaseOldWechatForAnotherStaff() throws Exception {
        when(merchantWechatSessionClient.exchange("first-code"))
            .thenReturn(new MerchantWechatSessionClient.WechatSession("openid-1"));
        when(merchantWechatSessionClient.exchange("second-code"))
            .thenReturn(new MerchantWechatSessionClient.WechatSession("openid-2"));
        String token = accessToken(passwordLogin("owner", "correct-password", "first-code"));

        mockMvc.perform(delete("/api/merchant-mini/account/wechat-binding")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk());
        passwordLogin("owner", "correct-password", "second-code")
            .andExpect(status().isOk());
        passwordLogin("cashier", "cashier-password", "first-code")
            .andExpect(status().isOk());
    }

    @Test
    void concurrentMerchantLoginsLeaveOnlyTheIndexedSessionValid() throws Exception {
        when(merchantWechatSessionClient.exchange("first-code"))
            .thenReturn(new MerchantWechatSessionClient.WechatSession("openid-1"));
        passwordLogin("owner", "correct-password", "first-code").andExpect(status().isOk());
        long ownerId = jdbcTemplate.queryForObject(
            "select id from staff_account where username = 'owner'", Long.class
        );
        Set<String> initialSessions = redisTemplate.keys("auth:*");
        if (!initialSessions.isEmpty()) {
            redisTemplate.delete(initialSessions);
        }

        int loginCount = 8;
        CountDownLatch ready = new CountDownLatch(loginCount);
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(loginCount);
        try {
            List<Future<MerchantAuthService.MerchantSessionView>> sessions =
                java.util.stream.IntStream.range(0, loginCount)
                    .mapToObj(ignored -> executor.submit(() -> {
                        ready.countDown();
                        start.await();
                        return authService.passwordLogin("owner", "correct-password", "first-code");
                    }))
                    .toList();
            ready.await();
            start.countDown();
            for (Future<MerchantAuthService.MerchantSessionView> session : sessions) {
                session.get();
            }
        } finally {
            executor.shutdownNow();
        }

        String indexedSession = redisTemplate.opsForValue().get("auth:merchant-staff:" + ownerId);
        assertThat(indexedSession).isNotBlank();
        assertThat(redisTemplate.keys("auth:session:*")).containsExactly("auth:session:" + indexedSession);
    }

    private org.springframework.test.web.servlet.ResultActions passwordLogin(
        String username,
        String password,
        String code
    ) throws Exception {
        return mockMvc.perform(post("/api/merchant-mini/auth/password-login")
            .contentType(APPLICATION_JSON)
            .content("{\"username\":\"%s\",\"password\":\"%s\",\"code\":\"%s\"}"
                .formatted(username, password, code)));
    }

    private String accessToken(org.springframework.test.web.servlet.ResultActions action) throws Exception {
        MvcResult result = action.andExpect(status().isOk()).andReturn();
        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        return body.path("data").path("accessToken").asText();
    }

    private void insert(String username, String hash, String role, boolean enabled) {
        jdbcTemplate.update(
            "insert into staff_account(username, password_hash, role, enabled) values (?, ?, ?, ?)",
            username, hash, role, enabled
        );
    }
}
