ALTER TABLE customer_order
    ADD COLUMN customer_hidden BOOLEAN NOT NULL DEFAULT FALSE AFTER inventory_released,
    ADD COLUMN admin_hidden BOOLEAN NOT NULL DEFAULT FALSE AFTER customer_hidden,
    ADD KEY idx_customer_order_customer_hidden_created (
        customer_id,
        customer_hidden,
        created_at
    ),
    ADD KEY idx_customer_order_admin_hidden_created (
        admin_hidden,
        created_at
    );
