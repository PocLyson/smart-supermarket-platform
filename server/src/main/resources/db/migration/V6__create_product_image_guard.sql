CREATE TABLE product_image_guard (
    image_url VARCHAR(500) NOT NULL,
    deleting BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (image_url)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE product
    ADD KEY idx_product_cover_image (cover_image_url);

INSERT IGNORE INTO product_image_guard(image_url, deleting)
SELECT DISTINCT cover_image_url, FALSE
  FROM product
 WHERE cover_image_url LIKE '/files/%';
