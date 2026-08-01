# Task 3 Report: Admin Product Archive Management

## Delivered

- Added typed `ProductArchiveStatus`, archived product fields, `archiveStatus` list-query serialization, and typed archive/restore API calls.
- Added an `ACTIVE`-by-default product archive filter with `ACTIVE`, `ARCHIVED`, and `ALL` options.
- Added low-emphasis danger-link delete actions with a confirmation that explicitly states historical orders are unaffected.
- Archived products now offer only Restore in desktop and mobile layouts; they cannot be edited, shelved, or deleted again.
- Restore refreshes the current filter and page, and tells the administrator to check inventory, price, and images before manually shelving the product.
- Added per-product action pending state to prevent repeated shelf, archive, or restore requests.

## TDD evidence

1. Added API contract and ProductView tests before the implementation.
2. `npm test -- ProductView.spec.ts` initially failed because the archive action and archive filter did not exist (2 failures).
3. `npm test -- AdminApiContract.spec.ts` initially failed with `TypeError: archiveProduct is not a function`.
4. Implemented the smallest API and view changes to satisfy those tests.

## Verification

- `cd admin && npm test -- ProductView.spec.ts AdminApiContract.spec.ts` — 14 tests passed.
- `cd admin && npm test` — 14 files / 70 tests passed.
- `cd admin && npm run build` — passed (`vue-tsc --noEmit` and Vite production build).
- `git diff --check` — passed.

## Concerns

None identified. The delete endpoint performs archival; the UI intentionally uses the user-facing word “删除” required by the brief.
