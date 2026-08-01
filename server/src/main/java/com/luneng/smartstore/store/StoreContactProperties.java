package com.luneng.smartstore.store;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "smart-store.store-contact")
public record StoreContactProperties(
    @NotBlank
    @Pattern(regexp = "^1[3-9]\\d{9}$")
    String phone,
    boolean customerServiceEnabled
) {
}
