# Task 4 Report: Product Archive Customer and Historical-Safety Regression

## Status

Complete. Regression-only change; no production code was modified because all new focused tests passed against the Task 1–3 implementation.

## Coverage added

- Server E2E completes a real order, archives its product, and proves:
  - public product detail becomes unavailable;
  - historical item name, quantity, unit price, subtotal, order total, completed pickup code, and order lookup remain unchanged;
  - exactly one `PRODUCT_ARCHIVE` audit row exists;
  - the product, online-inventory row, available quantity, inventory-ledger rows, and order ledger sum remain present and unchanged by archive.
- Audit-controller integration proves an OWNER can filter and inspect the single product-archive audit entry.
- Mini catalog regression proves a product is not retained after the public catalog no longer returns it.
- Mini checkout regression proves the exact business error `部分商品已下架，请移除后重试` is propagated without calling cart removal.
- Mini checkout-page regression proves the same error is shown unchanged in both the page error banner state and toast, without redirecting.
- Task 3 Minor follow-ups now prove the admin product view:
  - queries `archiveStatus: 'ACTIVE'` on initial load;
  - preserves the archived filter, keyword, and current page after restore;
  - exposes exactly Edit/Unshelf/Delete for active mobile cards and only Restore for archived mobile cards.

## Focused regression evidence

The task intentionally adds characterization regression tests after Tasks 1–3. Per the brief, the implementation was not damaged to manufacture a RED state. All added assertions were GREEN on their first focused execution, so no production fix was needed.

```powershell
cd server
.\mvnw.cmd '-Dtest=OrderLifecycleE2ETest,AdminAuditControllerTest' test
```

Result: `BUILD SUCCESS`; 4 tests run, 0 failures, 0 errors, 0 skipped. Testcontainers used MySQL 8.4 and Redis 7.4-alpine.

```powershell
cd mini
npm test -- product-catalog-visibility.spec.ts checkout.spec.ts checkout-note-page.spec.ts --run
```

Result: 3 files passed; 17 tests passed.

```powershell
cd admin
npm test -- ProductView.spec.ts --run
```

Result: 1 file passed; 14 tests passed.

## Full verification

```powershell
cd server
.\mvnw.cmd test
```

Result: `BUILD SUCCESS`; 76 tests run, 0 failures, 0 errors, 0 skipped.

```powershell
cd admin
npm test -- --run
npm run build
```

Result: 14 files / 74 tests passed; `vue-tsc --noEmit` passed; Vite production build passed with 1,670 modules transformed.

```powershell
cd mini
npm test -- --run
npm run typecheck
```

Result: 36 files / 135 tests passed; `tsc --noEmit` passed.

## Self-review

- Requirement coverage was checked line by line against `task-4-brief.md` and the Task 4 dispatch additions.
- Assertions use literal expected snapshots and observable behavior; the stale-cart test checks the prohibited cart-removal side effect rather than reasserting a mock return value.
- Historical safety is verified across the public catalog boundary, order snapshot and money fields, pickup code, audit count, physical product row, inventory row/current quantity, and inventory ledger.
- The exact customer-facing unavailable-product message is asserted in the checkout store and the page presentation path.
- Only tests and this report changed; no business behavior was altered.

## Concerns

- No functional concerns were found.
- Server output retains existing non-blocking warnings: Flyway advises that MySQL 8.4 is newer than its tested support range, and Spring Data reports Redis repository-identification warnings. These were present before this task and did not affect the 76-test pass.
- The codebase-memory index exposed only file/folder nodes for this worktree; after graph searches returned no symbols, discovery used the repository-approved targeted `rg`/file-read fallback.
