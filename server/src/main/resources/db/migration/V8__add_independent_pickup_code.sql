ALTER TABLE customer_order
    ADD COLUMN pickup_code VARCHAR(6) NULL AFTER idempotency_key;

UPDATE customer_order
SET pickup_code = LPAD(
    MOD(CONV(HEX(RANDOM_BYTES(4)), 16, 10), 1000000),
    6,
    '0'
)
WHERE pickup_code IS NULL;

ALTER TABLE customer_order
    MODIFY pickup_code VARCHAR(6) NOT NULL,
    ADD CONSTRAINT chk_customer_order_pickup_code
        CHECK (pickup_code REGEXP '^[0-9]{6}$');
