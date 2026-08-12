package com.luneng.smartstore.support;

import java.time.Instant;

public record SupportMessageView(
    long id,
    SupportSenderType senderSide,
    String content,
    String relatedOrderNo,
    Instant createdAt
) {
}
