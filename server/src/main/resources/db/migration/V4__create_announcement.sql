CREATE TABLE announcement (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    title VARCHAR(60) NOT NULL,
    content VARCHAR(2000) NOT NULL,
    status VARCHAR(32) NOT NULL,
    published_at TIMESTAMP(6) NULL,
    created_by BIGINT UNSIGNED NOT NULL,
    updated_by BIGINT UNSIGNED NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
        ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY idx_announcement_status_published (status, published_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
