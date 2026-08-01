# Merchant Product, Inventory, Announcement, and Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add role-safe mobile product management, inventory adjustment/ledger, announcement management, and owner-only business overview to the merchant mini program.

**Architecture:** Add merchant controllers as permission-aware adapters over the existing catalog, image, inventory, and announcement domain services. Extend inventory with server-side adjustment modes and ledger queries, and add a focused read-only analytics repository that derives metrics from trusted order/payment/refund data. The mini program uses workbench shortcuts rather than expanding the five-item tab bar.

**Tech Stack:** Spring Boot 3.5.9, JPA/JdbcTemplate, MySQL, existing image storage, native WeChat Mini Program TypeScript, TDesign MiniProgram, Vitest, Testcontainers.

## Global Constraints

- `OWNER` owns all product, announcement, permanent-delete, and analytics actions.
- `CASHIER` may view products and adjust/view inventory, but cannot mutate product data or see monetary analytics.
- Permanent delete requires an archived product and must fail when historical orders reference it.
- New announcements publish immediately; there is no draft button.
- Business overview supports today, 7 days, and 30 days only; complete finance stays in desktop admin.
- Product main image remains one image in Phase 3.

---

### Task 1: Merchant Catalog and Image APIs

**Files:**
- Create: `server/src/main/java/com/luneng/smartstore/merchant/MerchantCatalogController.java`
- Create: `server/src/main/java/com/luneng/smartstore/merchant/MerchantImageController.java`
- Modify: `server/src/main/java/com/luneng/smartstore/auth/SecurityConfig.java`
- Modify: `server/src/main/java/com/luneng/smartstore/catalog/ProductWriteRequest.java`
- Test: `server/src/test/java/com/luneng/smartstore/merchant/MerchantCatalogApiTest.java`
- Test: `server/src/test/java/com/luneng/smartstore/merchant/MerchantImageApiTest.java`

**Interfaces:**
- Produces: `/api/merchant-mini/categories` and `/api/merchant-mini/products` query endpoints for both roles.
- Produces owner-only product create/update/shelf/archive/restore/permanent-delete and `/api/merchant-mini/files/images` upload endpoints.
- Consumes existing `CatalogService` and `ImageStorageService`; no second product domain service.

- [ ] **Step 1: Write failing permission and behavior tests**

```java
mockMvc.perform(post("/api/merchant-mini/products")
        .with(merchantCashier())
        .contentType(APPLICATION_JSON)
        .content(validProductJson()))
    .andExpect(status().isForbidden());

mockMvc.perform(get("/api/merchant-mini/products").with(merchantCashier()))
    .andExpect(status().isOk());
```

Cover owner create/edit/shelf/archive/restore, permanent-delete historical-order rejection, invalid price/category/image, and client-type rejection.

- [ ] **Step 2: Run tests and verify failure**

Run: `cd server; .\mvnw.cmd -Dtest=MerchantCatalogApiTest,MerchantImageApiTest test`

Expected: FAIL with missing controllers.

- [ ] **Step 3: Implement thin controllers and exact security rules**

```java
@PreAuthorize("hasRole('OWNER')")
@PostMapping("/products")
ApiResponse<CatalogService.ProductView> create(
    @Valid @RequestBody ProductWriteRequest body,
    @AuthenticationPrincipal CurrentPrincipal actor,
    HttpServletRequest request
) { /* delegate to CatalogService.createProduct */ }
```

Do not broaden the existing admin routes. Merchant image upload uses the same 5 MB server limit, content sniffing, WebP/JPEG/PNG validation, and public product-image URL generation as admin upload.

- [ ] **Step 4: Run merchant plus catalog/image regression tests**

Run: `cd server; .\mvnw.cmd -Dtest=MerchantCatalogApiTest,MerchantImageApiTest,CatalogApiTest,ProductArchiveTest,ImageUploadTest test`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add server/src/main/java/com/luneng/smartstore/merchant server/src/main/java/com/luneng/smartstore/auth/SecurityConfig.java server/src/main/java/com/luneng/smartstore/catalog/ProductWriteRequest.java server/src/test/java/com/luneng/smartstore/merchant
git commit -m "feat: expose merchant catalog management"
```

### Task 2: Inventory Adjustment Modes and Ledger API

**Files:**
- Modify: `server/src/main/java/com/luneng/smartstore/inventory/InventoryRepository.java`
- Modify: `server/src/main/java/com/luneng/smartstore/inventory/InventoryService.java`
- Create: `server/src/main/java/com/luneng/smartstore/inventory/InventoryAdjustmentType.java`
- Create: `server/src/main/java/com/luneng/smartstore/merchant/MerchantInventoryController.java`
- Test: `server/src/test/java/com/luneng/smartstore/inventory/InventoryAdjustmentModeTest.java`
- Test: `server/src/test/java/com/luneng/smartstore/merchant/MerchantInventoryApiTest.java`

**Interfaces:**
- Produces: `InventoryAdjustmentType { INCREASE, DECREASE, SET_ACTUAL }`.
- Produces: `POST /api/merchant-mini/inventory/{productId}/adjustments` with `InventoryAdjustmentRequest(type, quantity, reason, expectedVersion)`.
- Produces: `GET /api/merchant-mini/inventory` and `/inventory/{productId}/ledger`.

- [ ] **Step 1: Write failing adjustment and concurrency tests**

```java
service.adjust(productId,
    new InventoryAdjustmentCommand(SET_ACTUAL, 12, "月末盘点", expectedVersion),
    cashier,
    "stock-set-1");
assertThat(service.current(productId)).isEqualTo(12);
```

Assert quantity must be positive for increase/decrease, target may be zero for `SET_ACTUAL`, reason is trimmed and 2–200 characters, negative final stock fails, stale version returns `INVENTORY_VERSION_CONFLICT`, and ledger records before/delta/after/actor/reason.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `cd server; .\mvnw.cmd -Dtest=InventoryAdjustmentModeTest,MerchantInventoryApiTest test`

Expected: FAIL.

- [ ] **Step 3: Implement atomic adjustment and ledger query**

```java
int delta = switch (command.type()) {
    case INCREASE -> command.quantity();
    case DECREASE -> -command.quantity();
    case SET_ACTUAL -> command.quantity() - before;
};
repository.adjustWithVersion(productId, delta, command.expectedVersion());
repository.ledger(productId, null, delta, before, before + delta,
    command.reason().trim(), "STAFF", actor.id());
```

Lock or version-check inventory in one transaction. Never compute `SET_ACTUAL` only in the client.

- [ ] **Step 4: Run inventory and order-reservation tests**

Run: `cd server; .\mvnw.cmd -Dtest=InventoryAdjustmentModeTest,MerchantInventoryApiTest,InventoryServiceTest,AdminInventoryControllerTest,OrderConcurrencyTest test`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add server/src/main/java/com/luneng/smartstore/inventory server/src/main/java/com/luneng/smartstore/merchant/MerchantInventoryController.java server/src/test/java/com/luneng/smartstore/inventory server/src/test/java/com/luneng/smartstore/merchant/MerchantInventoryApiTest.java
git commit -m "feat: add merchant inventory adjustments"
```

### Task 3: Merchant Announcement and Business Overview APIs

**Files:**
- Create: `server/src/main/java/com/luneng/smartstore/merchant/MerchantAnnouncementController.java`
- Create: `server/src/main/java/com/luneng/smartstore/analytics/BusinessOverviewRepository.java`
- Create: `server/src/main/java/com/luneng/smartstore/analytics/BusinessOverviewService.java`
- Create: `server/src/main/java/com/luneng/smartstore/analytics/BusinessOverviewView.java`
- Create: `server/src/main/java/com/luneng/smartstore/merchant/MerchantAnalyticsController.java`
- Test: `server/src/test/java/com/luneng/smartstore/merchant/MerchantAnnouncementApiTest.java`
- Test: `server/src/test/java/com/luneng/smartstore/analytics/BusinessOverviewServiceTest.java`

**Interfaces:**
- Produces owner-only announcement CRUD/lifecycle endpoints under `/api/merchant-mini/announcements`.
- Produces owner-only `GET /api/merchant-mini/analytics/overview?range=TODAY|DAYS_7|DAYS_30`.
- Produces `BusinessOverviewView(receivedCent, refundedCent, netCent, paidOrderCount, completedOrderCount, averageOrderCent, List<DailyPoint>, List<TopProduct>, PaymentMix)`.

- [ ] **Step 1: Write failing announcement and metric tests**

```java
assertThat(view.netCent()).isEqualTo(view.receivedCent() - view.refundedCent());
assertThat(view.averageOrderCent()).isEqualTo(
    view.paidOrderCount() == 0 ? null : view.receivedCent() / view.paidOrderCount());
```

Seed paid, unpaid, refunded, cancelled, and completed orders around Asia/Shanghai day boundaries. Assert cashier receives 403, refund counts only after refund `SUCCESS`, and empty average returns null/`—` at the UI boundary.

- [ ] **Step 2: Run tests and verify failure**

Run: `cd server; .\mvnw.cmd -Dtest=MerchantAnnouncementApiTest,BusinessOverviewServiceTest test`

Expected: FAIL.

- [ ] **Step 3: Implement shared announcement delegation and JDBC aggregates**

```java
public enum OverviewRange {
    TODAY(1), DAYS_7(7), DAYS_30(30);
    private final int days;
}
```

Use `ZoneId.of("Asia/Shanghai")` to derive inclusive start and exclusive end instants. Do not calculate financial totals in the mini program. Announcement mutations delegate to `AnnouncementService` so admin and merchant use one state machine.

- [ ] **Step 4: Run focused plus announcement/payment regression**

Run: `cd server; .\mvnw.cmd -Dtest=MerchantAnnouncementApiTest,BusinessOverviewServiceTest,AnnouncementApiTest,AnnouncementServiceTest,PaymentApplicationServiceTest,RefundProcessorTest test`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add server/src/main/java/com/luneng/smartstore/analytics server/src/main/java/com/luneng/smartstore/merchant server/src/test/java/com/luneng/smartstore/analytics server/src/test/java/com/luneng/smartstore/merchant
git commit -m "feat: add merchant announcements and overview"
```

### Task 4: Merchant Product Management UI

**Files:**
- Create: `merchant-mini/miniprogram/types/catalog.ts`
- Create: `merchant-mini/miniprogram/services/catalog.ts`
- Create: `merchant-mini/miniprogram/services/images.ts`
- Create: `merchant-mini/miniprogram/pages/products/*`
- Create: `merchant-mini/miniprogram/pages/product-edit/*`
- Modify: `merchant-mini/miniprogram/pages/workbench/*`
- Modify: `merchant-mini/miniprogram/app.json`
- Test: `merchant-mini/tests/product-management.spec.ts`
- Test: `merchant-mini/tests/product-permissions.spec.ts`

**Interfaces:**
- Consumes: Task 1 catalog/image endpoints.
- Produces: role-aware product list/edit presentation and `compressAndUploadMainImage`.

- [ ] **Step 1: Write failing product UI tests**

```ts
expect(productActions(product, 'CASHIER')).toEqual([])
expect(productActions(archivedWithoutOrders, 'OWNER')).toContain('PERMANENT_DELETE')
```

Cover filters, cents formatting, required fields, upload progress/failure, stale-version response, archive/restore, permanent-delete blocked copy, and customer-side absence after archive.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `cd merchant-mini; npm test -- --run tests/product-management.spec.ts tests/product-permissions.spec.ts`

Expected: FAIL.

- [ ] **Step 3: Implement mobile forms and guarded actions**

Use `wx.chooseMedia({ count: 1, mediaType: ['image'] })`, `wx.compressImage`, then authenticated upload. Disable save while uploading or submitting; only update local product data from the server response.

- [ ] **Step 4: Run merchant and customer catalog suites**

Run: `cd merchant-mini; npm test -- --run; npm run typecheck; cd ..\mini; npm test -- --run tests/product-catalog-visibility.spec.ts tests/out-of-stock-presentation.spec.ts; npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add merchant-mini mini/tests
git commit -m "feat: add merchant product management"
```

### Task 5: Merchant Inventory UI

**Files:**
- Create: `merchant-mini/miniprogram/types/inventory.ts`
- Create: `merchant-mini/miniprogram/services/inventory.ts`
- Create: `merchant-mini/miniprogram/pages/inventory/*`
- Create: `merchant-mini/miniprogram/pages/inventory-adjust/*`
- Create: `merchant-mini/miniprogram/pages/inventory-ledger/*`
- Modify: `merchant-mini/miniprogram/pages/workbench/*`
- Modify: `merchant-mini/miniprogram/app.json`
- Test: `merchant-mini/tests/inventory.spec.ts`

**Interfaces:**
- Consumes: Task 2 inventory endpoints.
- Produces: `buildAdjustment(type, quantity, reason, expectedVersion)` and stock status presentation.

- [ ] **Step 1: Write failing adjustment tests**

```ts
expect(buildAdjustment('SET_ACTUAL', 0, '盘点为零', 3)).toEqual({
  type: 'SET_ACTUAL', quantity: 0, reason: '盘点为零', expectedVersion: 3,
})
```

Cover all filters, zero-stock sorting, owner/cashier parity, reason validation, disabled double submit, conflict reload, and ledger display.

- [ ] **Step 2: Run focused test and verify failure**

Run: `cd merchant-mini; npm test -- --run tests/inventory.spec.ts`

Expected: FAIL.

- [ ] **Step 3: Implement inventory pages**

Use separate controls for increase, decrease, and set actual. Show before and expected after quantities before confirmation, but treat the server response as final after submission.

- [ ] **Step 4: Run merchant suite and typecheck**

Run: `cd merchant-mini; npm test -- --run; npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add merchant-mini/miniprogram merchant-mini/tests
git commit -m "feat: add merchant inventory management"
```

### Task 6: Merchant Announcement and Overview UI

**Files:**
- Create: `merchant-mini/miniprogram/types/announcement.ts`
- Create: `merchant-mini/miniprogram/types/analytics.ts`
- Create: `merchant-mini/miniprogram/services/announcements.ts`
- Create: `merchant-mini/miniprogram/services/analytics.ts`
- Create: `merchant-mini/miniprogram/pages/announcements/*`
- Create: `merchant-mini/miniprogram/pages/announcement-edit/*`
- Create: `merchant-mini/miniprogram/pages/business-overview/*`
- Modify: `merchant-mini/miniprogram/pages/workbench/*`
- Modify: `merchant-mini/miniprogram/app.json`
- Test: `merchant-mini/tests/announcements.spec.ts`
- Test: `merchant-mini/tests/business-overview.spec.ts`

**Interfaces:**
- Consumes: Task 3 endpoints.
- Produces: owner-only workbench shortcuts and metric presentation.

- [ ] **Step 1: Write failing announcement and metric tests**

```ts
expect(primaryAnnouncementAction()).toBe('立即发布')
expect(formatAverageOrder(null)).toBe('—')
expect(workbenchManagementItems('CASHIER').map((x) => x.key))
  .toEqual(['products', 'inventory'])
```

Cover title/content length, publish/downline/delete confirmations, today/7/30 range, cents formatting, net amount, top products, empty/error state, and cashier route guard.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `cd merchant-mini; npm test -- --run tests/announcements.spec.ts tests/business-overview.spec.ts`

Expected: FAIL.

- [ ] **Step 3: Implement mobile announcement forms and compact charts**

Use simple CSS bars/sparklines derived from server daily points; do not add a chart dependency for three fixed ranges. Keep full tables and exports out of merchant-mini.

- [ ] **Step 4: Run all Phase 3 verification**

Run server clean verify, merchant-mini tests/typecheck, customer mini tests/typecheck, and admin tests/build. Compare one fixed 7-day data fixture between `BusinessOverviewServiceTest` and admin query output.

- [ ] **Step 5: Commit**

```powershell
git add merchant-mini/miniprogram merchant-mini/tests
git commit -m "feat: add merchant announcements and overview"
```

### Task 7: Phase 3 Real-Device Acceptance

**Files:**
- Modify: `docs/operations/trial-acceptance.md`
- Modify: `docs/operations/merchant-mini-local-testing.md`

**Interfaces:**
- Produces: reproducible acceptance evidence for product, inventory, announcement, and overview flows.

- [ ] **Step 1: Add role-by-role acceptance matrix**

Include every permission row from the approved spec and expected 200/403 outcome.

- [ ] **Step 2: Test on owner and cashier real devices**

Verify image upload, stale edit, archive/restore, permanent-delete rejection, all inventory adjustment modes, announcement immediately visible on customer home, and metric agreement.

- [ ] **Step 3: Run final automated suites**

Run all commands from the roadmap cross-phase verification section and require PASS.

- [ ] **Step 4: Run `git diff --check`**

Expected: no output.

- [ ] **Step 5: Commit**

```powershell
git add docs/operations
git commit -m "docs: record merchant operations acceptance"
```
