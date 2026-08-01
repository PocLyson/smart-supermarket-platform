package com.luneng.smartstore.store;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "smart-store.store-contact")
public record StoreContactProperties(
    String phone,
    boolean customerServiceEnabled
) {
}
