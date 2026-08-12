package com.luneng.smartstore.support;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SupportSendMessageRequest(
    @NotBlank String content,
    @Size(max = 32) String orderNo,
    @NotBlank @Size(max = 64) String clientMessageId
) {
}
