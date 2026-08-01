package com.luneng.smartstore.store;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Configuration;

class StoreContactPropertiesTest {
    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
        .withUserConfiguration(ContactConfiguration.class)
        .withPropertyValues("smart-store.store-contact.customer-service-enabled=true");

    @Test
    void blankOrMalformedPhonePreventsApplicationStartup() {
        assertInvalidPhone("");
        assertInvalidPhone("12345678901");
    }

    @Test
    void configuredMainlandMobilePhoneBindsSuccessfully() {
        contextRunner
            .withPropertyValues("smart-store.store-contact.phone=18653045492")
            .run(context -> {
                assertThat(context).hasNotFailed();
                assertThat(context.getBean(StoreContactProperties.class).phone())
                    .isEqualTo("18653045492");
            });
    }

    private void assertInvalidPhone(String phone) {
        contextRunner
            .withPropertyValues("smart-store.store-contact.phone=" + phone)
            .run(context -> assertThat(context).hasFailed());
    }

    @Configuration(proxyBeanMethods = false)
    @EnableConfigurationProperties(StoreContactProperties.class)
    static class ContactConfiguration {
    }
}
