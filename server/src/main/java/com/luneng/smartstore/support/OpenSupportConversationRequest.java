package com.luneng.smartstore.support;

import jakarta.validation.constraints.Size;

public record OpenSupportConversationRequest(
    @Size(max = 32) String orderNo
) {
}
