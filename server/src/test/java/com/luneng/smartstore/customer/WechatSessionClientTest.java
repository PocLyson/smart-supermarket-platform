package com.luneng.smartstore.customer;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;

class WechatSessionClientTest {
    @Test
    void localMockMapsWechatCodeToConfiguredDevelopmentCustomer() {
        WechatSessionClient client = new WechatSessionClient(
            RestClient.builder(),
            "unused-local-app-id",
            "unused-local-app-secret",
            true,
            "local-dev-customer"
        );

        WechatSessionClient.WechatSession session = client.exchange("wechat-devtools-code");

        assertThat(session.openid()).isEqualTo("local-dev-customer");
        assertThat(session.sessionKey()).isEqualTo("local-mock-session");
    }
}
