package com.luneng.smartstore.support;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "customer_support_conversation")
public class SupportConversation {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "customer_id", nullable = false, unique = true)
    private long customerId;

    @Column(name = "last_related_order_id")
    private Long lastRelatedOrderId;

    @Column(name = "last_message_preview", length = 160)
    private String lastMessagePreview;

    @Column(name = "last_message_at")
    private Instant lastMessageAt;

    @Column(name = "customer_unread_count", nullable = false)
    private int customerUnreadCount;

    @Column(name = "merchant_unread_count", nullable = false)
    private int merchantUnreadCount;

    @Version
    @Column(nullable = false)
    private long version;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected SupportConversation() {
    }

    public SupportConversation(long customerId, Long lastRelatedOrderId) {
        this.customerId = customerId;
        this.lastRelatedOrderId = lastRelatedOrderId;
    }

    public void relateOrder(Long orderId) {
        if (orderId != null) {
            lastRelatedOrderId = orderId;
        }
    }

    public void recordMessage(
        SupportSenderType senderType,
        String preview,
        Instant sentAt,
        Long relatedOrderId
    ) {
        lastMessagePreview = preview;
        lastMessageAt = sentAt;
        relateOrder(relatedOrderId);
        if (senderType == SupportSenderType.CUSTOMER) {
            merchantUnreadCount += 1;
        } else {
            customerUnreadCount += 1;
        }
    }

    public void markCustomerRead(int remainingUnreadCount) {
        customerUnreadCount = remainingUnreadCount;
    }

    public void markMerchantRead(int remainingUnreadCount) {
        merchantUnreadCount = remainingUnreadCount;
    }

    public Long getId() {
        return id;
    }

    public long getCustomerId() {
        return customerId;
    }

    public Long getLastRelatedOrderId() {
        return lastRelatedOrderId;
    }

    public String getLastMessagePreview() {
        return lastMessagePreview;
    }

    public Instant getLastMessageAt() {
        return lastMessageAt;
    }

    public int getCustomerUnreadCount() {
        return customerUnreadCount;
    }

    public int getMerchantUnreadCount() {
        return merchantUnreadCount;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
