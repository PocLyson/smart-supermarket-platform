CREATE TABLE customer_user (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    openid VARCHAR(128) NOT NULL,
    nickname VARCHAR(80) NULL,
    avatar_url VARCHAR(500) NULL,
    pickup_name VARCHAR(40) NULL,
    phone VARCHAR(20) NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uk_customer_user_openid (openid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE staff_account (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    username VARCHAR(64) NOT NULL,
    password_hash VARCHAR(100) NOT NULL,
    role VARCHAR(32) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMP(6) NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uk_staff_account_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE category (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(80) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE product (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    category_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(160) NOT NULL,
    price_cent BIGINT UNSIGNED NOT NULL,
    unit VARCHAR(40) NOT NULL,
    cover_image_url VARCHAR(500) NULL,
    description TEXT NULL,
    on_shelf BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY idx_product_category_shelf (category_id, on_shelf),
    CONSTRAINT fk_product_category FOREIGN KEY (category_id) REFERENCES category (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE online_inventory (
    product_id BIGINT UNSIGNED NOT NULL,
    available_quantity INT UNSIGNED NOT NULL DEFAULT 0,
    version BIGINT UNSIGNED NOT NULL DEFAULT 0,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (product_id),
    CONSTRAINT chk_online_inventory_nonnegative CHECK (available_quantity >= 0),
    CONSTRAINT fk_online_inventory_product FOREIGN KEY (product_id) REFERENCES product (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE customer_order (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    order_no VARCHAR(32) NOT NULL,
    customer_id BIGINT UNSIGNED NOT NULL,
    idempotency_key VARCHAR(128) NOT NULL,
    pickup_name VARCHAR(40) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    total_cent BIGINT UNSIGNED NOT NULL,
    status VARCHAR(32) NOT NULL,
    payment_status VARCHAR(32) NOT NULL,
    payment_method VARCHAR(32) NULL,
    cancelled_by VARCHAR(32) NULL,
    cancel_reason VARCHAR(500) NULL,
    inventory_released BOOLEAN NOT NULL DEFAULT FALSE,
    accepted_at TIMESTAMP(6) NULL,
    ready_at TIMESTAMP(6) NULL,
    paid_at TIMESTAMP(6) NULL,
    completed_at TIMESTAMP(6) NULL,
    cancelled_at TIMESTAMP(6) NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uk_customer_order_no (order_no),
    UNIQUE KEY uk_customer_order_idempotency (customer_id, idempotency_key),
    KEY idx_customer_order_customer_created (customer_id, created_at),
    KEY idx_customer_order_status_created (status, created_at),
    CONSTRAINT fk_customer_order_customer FOREIGN KEY (customer_id) REFERENCES customer_user (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE order_item (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    order_id BIGINT UNSIGNED NOT NULL,
    product_id BIGINT UNSIGNED NOT NULL,
    product_name VARCHAR(160) NOT NULL,
    unit VARCHAR(40) NOT NULL,
    unit_price_cent BIGINT UNSIGNED NOT NULL,
    quantity INT UNSIGNED NOT NULL,
    subtotal_cent BIGINT UNSIGNED NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY idx_order_item_order (order_id),
    CONSTRAINT chk_order_item_quantity_positive CHECK (quantity > 0),
    CONSTRAINT fk_order_item_order FOREIGN KEY (order_id) REFERENCES customer_order (id),
    CONSTRAINT fk_order_item_product FOREIGN KEY (product_id) REFERENCES product (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE inventory_ledger (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    product_id BIGINT UNSIGNED NOT NULL,
    order_id BIGINT UNSIGNED NULL,
    quantity_delta INT NOT NULL,
    quantity_before INT UNSIGNED NOT NULL,
    quantity_after INT UNSIGNED NOT NULL,
    reason VARCHAR(200) NOT NULL,
    actor_type VARCHAR(32) NULL,
    actor_id BIGINT UNSIGNED NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY idx_inventory_ledger_product_created (product_id, created_at),
    KEY idx_inventory_ledger_order (order_id),
    CONSTRAINT fk_inventory_ledger_product FOREIGN KEY (product_id) REFERENCES product (id),
    CONSTRAINT fk_inventory_ledger_order FOREIGN KEY (order_id) REFERENCES customer_order (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE order_status_history (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    order_id BIGINT UNSIGNED NOT NULL,
    from_status VARCHAR(32) NULL,
    to_status VARCHAR(32) NOT NULL,
    actor_type VARCHAR(32) NOT NULL,
    actor_id BIGINT UNSIGNED NOT NULL,
    remark VARCHAR(500) NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY idx_order_status_history_order_created (order_id, created_at),
    CONSTRAINT fk_order_status_history_order FOREIGN KEY (order_id) REFERENCES customer_order (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE operation_log (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    actor_id BIGINT UNSIGNED NOT NULL,
    actor_type VARCHAR(32) NOT NULL,
    action VARCHAR(80) NOT NULL,
    object_type VARCHAR(80) NOT NULL,
    object_id VARCHAR(128) NOT NULL,
    result_summary VARCHAR(500) NOT NULL,
    request_id VARCHAR(128) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY idx_operation_log_actor_created (actor_id, created_at),
    KEY idx_operation_log_object (object_type, object_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE idempotency_record (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    customer_id BIGINT UNSIGNED NOT NULL,
    idempotency_key VARCHAR(128) NOT NULL,
    order_id BIGINT UNSIGNED NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uk_idempotency_customer_key (customer_id, idempotency_key),
    CONSTRAINT fk_idempotency_customer FOREIGN KEY (customer_id) REFERENCES customer_user (id),
    CONSTRAINT fk_idempotency_order FOREIGN KEY (order_id) REFERENCES customer_order (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
