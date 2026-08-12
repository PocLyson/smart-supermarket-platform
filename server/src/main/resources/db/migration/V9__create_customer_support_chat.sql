CREATE TABLE customer_support_conversation (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    customer_id BIGINT UNSIGNED NOT NULL,
    last_related_order_id BIGINT UNSIGNED NULL,
    last_message_preview VARCHAR(160) NULL,
    last_message_at TIMESTAMP(6) NULL,
    customer_unread_count INT UNSIGNED NOT NULL DEFAULT 0,
    merchant_unread_count INT UNSIGNED NOT NULL DEFAULT 0,
    version BIGINT UNSIGNED NOT NULL DEFAULT 0,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uk_support_conversation_customer (customer_id),
    KEY idx_support_conversation_last_message (last_message_at, id),
    KEY idx_support_conversation_merchant_unread (merchant_unread_count),
    CONSTRAINT fk_support_conversation_customer
        FOREIGN KEY (customer_id) REFERENCES customer_user (id),
    CONSTRAINT fk_support_conversation_order
        FOREIGN KEY (last_related_order_id) REFERENCES customer_order (id),
    CONSTRAINT chk_support_conversation_customer_unread
        CHECK (customer_unread_count >= 0),
    CONSTRAINT chk_support_conversation_merchant_unread
        CHECK (merchant_unread_count >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE customer_support_message (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    conversation_id BIGINT UNSIGNED NOT NULL,
    sender_type VARCHAR(32) NOT NULL,
    sender_id BIGINT UNSIGNED NOT NULL,
    related_order_id BIGINT UNSIGNED NULL,
    client_message_id VARCHAR(64) NOT NULL,
    content VARCHAR(500) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uk_support_message_sender_client (
        sender_type, sender_id, client_message_id
    ),
    KEY idx_support_message_conversation_id (conversation_id, id),
    KEY idx_support_message_order (related_order_id),
    CONSTRAINT fk_support_message_conversation
        FOREIGN KEY (conversation_id) REFERENCES customer_support_conversation (id),
    CONSTRAINT fk_support_message_order
        FOREIGN KEY (related_order_id) REFERENCES customer_order (id),
    CONSTRAINT chk_support_message_sender_type
        CHECK (sender_type IN ('CUSTOMER', 'MERCHANT')),
    CONSTRAINT chk_support_message_content
        CHECK (CHAR_LENGTH(TRIM(content)) BETWEEN 1 AND 500)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
