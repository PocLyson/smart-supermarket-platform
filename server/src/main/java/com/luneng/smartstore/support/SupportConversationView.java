package com.luneng.smartstore.support;

import java.time.Instant;

public record SupportConversationView(
    long id,
    String customerDisplayName,
    String maskedPhone,
    String relatedOrderNo,
    String lastMessagePreview,
    Instant lastMessageAt,
    int unreadCount
) {
}
