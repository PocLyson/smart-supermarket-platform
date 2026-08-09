# Final fix A report: independent pickup secret

## Root cause and data flow

The pickup code was not part of the order state. `PickupCode.fromOrderNo` extracted the
last six digits of the merchant-visible order number, while both `OrderView.from` and
`CustomerOrder.verifyPickupCode` independently recomputed that same value. The
`customer_order` table had no pickup-code column, and order creation generated only an
order number. Consequently, the order number disclosed the verification secret and no
secret was persisted.

The corrected flow is:

1. `OrderApplicationService.create` requests a six-digit code from
   `PickupCodeGenerator`, which uses `SecureRandom` and constructs ASCII digits without
   locale-sensitive formatting.
2. `CustomerOrder` validates and stores the code in its required `pickup_code` field.
3. Customer create/list/detail views read the stored code.
4. Admin and merchant list/detail views continue to omit the code.
5. Admin and merchant verification compare employee input with the stored order field.

## Migration strategy

`V8__add_independent_pickup_code.sql` adds a nullable `VARCHAR(6)` column, backfills
every legacy row independently from MySQL `RANDOM_BYTES(4)`, formats the value as six
ASCII digits, then makes the column `NOT NULL` and adds a `[0-9]{6}` check constraint.
The backfill never reads `order_no`, and no uniqueness constraint was added because the
domain does not require global pickup-code uniqueness.

The migration integration test starts MySQL 8.4, migrates only through V7, inserts four
legacy orders whose visible numbers all end in `123456`, then applies V8. It verifies
all codes have the required format, the set is not wholly the legacy-derived value,
and invalid full-width or five-digit values are rejected by the database.

## TDD evidence

RED:

- `OrderApplicationServiceTest#createdPickupSecretIsNotDeterminedByMerchantVisibleOrderNumber`:
  1 failure, 0 errors; every code equaled its order-number suffix.
- `MerchantOrderApiTest#verifyPickupValidatesCodeBeforePayingAndCompletesAtomically`
  plus `PickupCodeMigrationTest`: 2 failures, 0 errors; `pickup_code` column count was
  zero in both the application schema and V7-to-latest migration scenario.

GREEN:

- Minimal regression set: 3 tests, 0 failures, 0 errors.
- Focused order/domain/API set: 27 tests, 0 failures, 0 errors.
- Full server verification: `server\\mvnw.cmd clean verify` completed with exit code 0;
  111 tests, 0 failures, 0 errors, 0 skipped; `BUILD SUCCESS` in 8 minutes 44 seconds.

The full build retains pre-existing informational warnings about one deprecated Spring
Data API and Flyway's MySQL 8.4 support range; neither produced a verification failure.
