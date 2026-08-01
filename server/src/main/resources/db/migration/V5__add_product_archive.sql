ALTER TABLE product
    ADD COLUMN archived BOOLEAN NOT NULL DEFAULT FALSE AFTER on_shelf,
    ADD COLUMN archived_at TIMESTAMP(6) NULL AFTER archived,
    ADD COLUMN archived_by BIGINT UNSIGNED NULL AFTER archived_at,
    ADD KEY idx_product_archived_category_shelf (archived, category_id, on_shelf);
