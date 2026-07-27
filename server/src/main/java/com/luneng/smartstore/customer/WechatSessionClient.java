package com.luneng.smartstore.customer;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.luneng.smartstore.common.api.BusinessException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
public class WechatSessionClient {
    private final RestClient restClient;
    private final String appId;
    private final String appSecret;

    public WechatSessionClient(
        RestClient.Builder builder,
        @Value("${smart-store.wechat.app-id}") String appId,
        @Value("${smart-store.wechat.app-secret}") String appSecret
    ) {
        this.restClient = builder.baseUrl("https://api.weixin.qq.com").build();
        this.appId = appId;
        this.appSecret = appSecret;
    }

    public WechatSession exchange(String code) {
        WechatResponse response = restClient.get()
            .uri(uri -> uri.path("/sns/jscode2session")
                .queryParam("appid", appId)
                .queryParam("secret", appSecret)
                .queryParam("js_code", code)
                .queryParam("grant_type", "authorization_code")
                .build())
            .retrieve()
            .body(WechatResponse.class);
        if (response == null || response.openid() == null || response.openid().isBlank()) {
            throw new BusinessException(
                "WECHAT_LOGIN_FAILED",
                "微信登录失败",
                HttpStatus.UNAUTHORIZED
            );
        }
        return new WechatSession(response.openid(), response.sessionKey());
    }

    public record WechatSession(String openid, String sessionKey) {
    }

    private record WechatResponse(
        String openid,
        @JsonProperty("session_key") String sessionKey,
        @JsonProperty("errcode") Integer errorCode
    ) {
    }
}
