package com.luneng.smartstore.support;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(name = "customer_support_message")
public class SupportMessage {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "conversation_id", nullable = false)
    private long conversationId;

    @Enumerated(EnumType.STRING)
    @Column(name = "sender_type", nullable = false, length = 32)
    private SupportSenderType senderType;

    @Column(name = "sender_id", nullable = false)
    private long senderId;

    @Column(name = "related_order_id")
    private Long relatedOrderId;

    @Column(name = "client_message_id", nullable = false, length = 64)
    private String clientMessageId;

    @Column(nullable = false, length = 500)
    private String content;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected SupportMessage() {
    }

    public SupportMessage(
        long conversationId,
        SupportSenderType senderType,
        long senderId,
        Long relatedOrderId,
        String clientMessageId,
        String content
    ) {
        this.conversationId = conversationId;
        this.senderType = senderType;
        this.senderId = senderId;
        this.relatedOrderId = relatedOrderId;
        this.clientMessageId = clientMessageId;
        this.content = content;
    }

    public Long getId() {
        return id;
    }

    public long getConversationId() {
        return conversationId;
    }

    public SupportSenderType getSenderType() {
        return senderType;
    }

    public long getSenderId() {
        return senderId;
    }

    public Long getRelatedOrderId() {
        return relatedOrderId;
    }

    public String getClientMessageId() {
        return clientMessageId;
    }

    public String getContent() {
        return content;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
