package com.luneng.smartstore.support;

import jakarta.validation.constraints.Positive;

public record SupportReadRequest(
    @Positive long lastMessageId
) {
}
