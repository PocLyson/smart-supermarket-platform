package com.luneng.smartstore.customer;

import static org.mockito.Mockito.when;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.luneng.smartstore.auth.ActorType;
import com.luneng.smartstore.auth.CurrentPrincipal;
import com.luneng.smartstore.auth.JwtService;
import com.luneng.smartstore.support.IntegrationTestBase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@AutoConfigureMockMvc
class CustomerAuthControllerTest extends IntegrationTestBase {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private StringRedisTemplate redisTemplate;

    @MockitoBean
    private WechatSessionClient wechatSessionClient;

    @Test
    void wechatCodeCreatesCustomerAndReturnsCustomerToken() throws Exception {
        when(wechatSessionClient.exchange("valid-code"))
            .thenReturn(new WechatSessionClient.WechatSession("openid-123", "session-key"));

        mockMvc.perform(post("/api/mini/auth/wechat")
                .contentType(APPLICATION_JSON)
                .content("""
                    {"code":"valid-code"}
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.accessToken").isNotEmpty())
            .andExpect(jsonPath("$.data.profileComplete").value(false))
            .andExpect(jsonPath("$.data.sessionKey").doesNotExist());
    }

    @Test
    void customerCannotUseAdminTokenOnProfileEndpoint() throws Exception {
        String sessionId = "staff-session";
        redisTemplate.opsForValue().set("auth:session:" + sessionId, "99");
        String ownerToken = jwtService.issue(
            new CurrentPrincipal(99L, ActorType.STAFF, "OWNER", sessionId)
        );

        mockMvc.perform(get("/api/mini/profile")
                .header("Authorization", "Bearer " + ownerToken))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }
}
