package com.luneng.smartstore.merchantauth;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.luneng.smartstore.common.api.BusinessException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
public class MerchantWechatSessionClient {
    private final RestClient restClient;
    private final String appId;
    private final String appSecret;
    private final boolean localMockEnabled;
    private final String localMockOpenid;

    public MerchantWechatSessionClient(
        RestClient.Builder builder,
        @Value("${smart-store.merchant-wechat.app-id}") String appId,
        @Value("${smart-store.merchant-wechat.app-secret}") String appSecret,
        @Value("${smart-store.merchant-wechat.local-mock-enabled:false}") boolean localMockEnabled,
        @Value("${smart-store.merchant-wechat.local-mock-openid:local-dev-staff}") String localMockOpenid
    ) {
        this.restClient = builder.baseUrl("https://api.weixin.qq.com").build();
        this.appId = appId;
        this.appSecret = appSecret;
        this.localMockEnabled = localMockEnabled;
        this.localMockOpenid = localMockOpenid;
    }

    public WechatSession exchange(String code) {
        if (localMockEnabled) {
            return new WechatSession(localMockOpenid);
        }
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
            throw new BusinessException("WECHAT_LOGIN_FAILED", "微信登录失败", HttpStatus.UNAUTHORIZED);
        }
        return new WechatSession(response.openid());
    }

    public record WechatSession(String openid) {
    }

    private record WechatResponse(
        String openid,
        @JsonProperty("errcode") Integer errorCode
    ) {
    }
}
