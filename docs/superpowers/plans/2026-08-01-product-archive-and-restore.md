# Product Archive and Restore Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the owner a safe product delete/restore workflow that removes archived products from all customer shopping paths while preserving inventory history and historical orders.

**Architecture:** Implement product deletion as an archive state on the existing `Product` aggregate. Public catalog queries always exclude archived products, while owner queries accept an explicit archive filter. Archive forces the product off shelf; restore clears archive metadata but leaves the product off shelf until manually reviewed and published.

**Tech Stack:** Java 17, Spring Boot 3.5.9, JPA/EntityManager, Flyway/MySQL 8.4, Spring Security, Vue 3, Element Plus, native WeChat Mini Program, Vitest, JUnit 5/Testcontainers.

## Global Constraints

- Product deletion is always soft deletion; no `DELETE FROM product` operation is allowed.
- Archiving immediately forces `onShelf = false`.
- Public list, search and detail APIs must exclude archived products.
- Archived products already in a cart cannot be ordered; return `部分商品已下架，请移除后重试`.
- Historical order snapshots, order totals, pickup codes, inventory ledgers and audit logs remain available.
- Restoring clears archive metadata but does not put the product on shelf.
- Only `OWNER` can archive or restore products; `CASHIER` receives HTTP 403.
- Archive and restore audit actions are exactly `PRODUCT_ARCHIVE` and `PRODUCT_RESTORE`.
- Repeating archive/restore does not create duplicate audit records or invalid transitions.

---

### Task 1: Add product archive state and migration

**Files:**
- Create: `server/src/main/resources/db/migration/V5__add_product_archive.sql`
- Create: `server/src/main/java/com/luneng/smartstore/catalog/ProductArchiveStatus.java`
- Modify: `server/src/main/java/com/luneng/smartstore/catalog/Product.java:15-110`
- Test: `server/src/test/java/com/luneng/smartstore/catalog/ProductArchiveTest.java`

**Interfaces:**
- Consumes: existing `Product` constructor, `update(...)`, and `setOnShelf(...)` behavior.
- Produces: `Product.archive(long actorId): boolean`, `Product.restore(long actorId): boolean`, `isArchived`, `getArchivedAt`, and `getArchivedBy`.

- [ ] **Step 1: Write failing aggregate and migration tests**

Add tests that load a product and verify:

```java
assertThat(product.archive(7L)).isTrue();
assertThat(product.isArchived()).isTrue();
assertThat(product.isOnShelf()).isFalse();
assertThat(product.getArchivedAt()).isNotNull();
assertThat(product.getArchivedBy()).isEqualTo(7L);

assertThat(product.archive(7L)).isFalse();
assertThat(product.restore(7L)).isTrue();
assertThat(product.isArchived()).isFalse();
assertThat(product.isOnShelf()).isFalse();
assertThat(product.restore(7L)).isFalse();
```

Query `information_schema.columns` or persist/reload the entity to prove Flyway added all three fields.

- [ ] **Step 2: Run the focused test and verify failure**

Run:

```powershell
cd server
.\mvnw.cmd -Dtest=ProductArchiveTest test
```

Expected: FAIL because the columns and methods do not exist.

- [ ] **Step 3: Add the archive migration**

Create:

```sql
ALTER TABLE product
    ADD COLUMN archived BOOLEAN NOT NULL DEFAULT FALSE AFTER on_shelf,
    ADD COLUMN archived_at TIMESTAMP(6) NULL AFTER archived,
    ADD COLUMN archived_by BIGINT UNSIGNED NULL AFTER archived_at,
    ADD KEY idx_product_archived_category_shelf (archived, category_id, on_shelf);
```

- [ ] **Step 4: Implement idempotent aggregate transitions**

Add fields and methods:

```java
public boolean archive(long actorId) {
    if (archived) return false;
    archived = true;
    archivedAt = Instant.now();
    archivedBy = actorId;
    onShelf = false;
    return true;
}

public boolean restore(long actorId) {
    if (!archived) return false;
    archived = false;
    archivedAt = null;
    archivedBy = null;
    onShelf = false;
    return true;
}
```

Reject `update(...)` and `setOnShelf(true)` while archived with business code `PRODUCT_ARCHIVED`. Keep `setOnShelf(false)` idempotent.

- [ ] **Step 5: Verify the aggregate test and commit**

Run:

```powershell
cd server
.\mvnw.cmd -Dtest=ProductArchiveTest test
```

Expected: PASS.

```powershell
git add -- server/src/main/resources/db/migration/V5__add_product_archive.sql server/src/main/java/com/luneng/smartstore/catalog/Product.java server/src/main/java/com/luneng/smartstore/catalog/ProductArchiveStatus.java server/src/test/java/com/luneng/smartstore/catalog/ProductArchiveTest.java
git commit -m "feat: add product archive state"
```

### Task 2: Enforce archive filtering and expose owner archive/restore APIs

**Files:**
- Modify: `server/src/main/java/com/luneng/smartstore/catalog/CatalogRepository.java:35-91`
- Modify: `server/src/main/java/com/luneng/smartstore/catalog/CatalogService.java:53-171`
- Modify: `server/src/main/java/com/luneng/smartstore/catalog/AdminCatalogController.java:45-113`
- Modify: `server/src/main/java/com/luneng/smartstore/catalog/MiniCatalogController.java:20-58`
- Modify: `server/src/main/java/com/luneng/smartstore/order/OrderApplicationService.java:72-86`
- Test: `server/src/test/java/com/luneng/smartstore/catalog/CatalogApiTest.java`
- Test: `server/src/test/java/com/luneng/smartstore/order/MiniOrderControllerTest.java`

**Interfaces:**
- Consumes: Task 1 aggregate methods and existing owner-only `/api/admin/products/**` security matcher.
- Produces: `archiveStatus=ACTIVE|ARCHIVED|ALL`, `DELETE /api/admin/products/{id}`, and `POST /api/admin/products/{id}/restore`.

- [ ] **Step 1: Add failing public filtering, admin filtering and checkout tests**

Extend integration tests to prove:

```java
mockMvc.perform(delete("/api/admin/products/10")
        .header("Authorization", "Bearer " + ownerToken))
    .andExpect(status().isOk())
    .andExpect(jsonPath("$.data.archived").value(true))
    .andExpect(jsonPath("$.data.onShelf").value(false));

mockMvc.perform(get("/api/mini/products"))
    .andExpect(jsonPath("$.data.items[?(@.id == 10)]").doesNotExist());

mockMvc.perform(get("/api/admin/products")
        .header("Authorization", "Bearer " + ownerToken)
        .param("archiveStatus", "ARCHIVED"))
    .andExpect(jsonPath("$.data.items[0].id").value(10));

mockMvc.perform(post("/api/admin/products/10/restore")
        .header("Authorization", "Bearer " + ownerToken))
    .andExpect(status().isOk())
    .andExpect(jsonPath("$.data.archived").value(false))
    .andExpect(jsonPath("$.data.onShelf").value(false));
```

Also assert cashier gets 403, repeated archive/restore keeps HTTP 200 without duplicate audit, public detail returns 404, and order creation returns HTTP 409 with message `部分商品已下架，请移除后重试`.

- [ ] **Step 2: Run focused API tests and verify failure**

Run:

```powershell
cd server
.\mvnw.cmd -Dtest=CatalogApiTest,MiniOrderControllerTest test
```

Expected: FAIL because the query filter and endpoints are absent.

- [ ] **Step 3: Add archive filtering to repository queries**

Define:

```java
public enum ProductArchiveStatus {
    ACTIVE,
    ARCHIVED,
    ALL
}
```

Extend `products(...)` with a `ProductArchiveStatus archiveStatus` argument. For public calls always append:

```sql
and p.archived = false
and p.onShelf = true
and p.category.enabled = true
```

For admin calls append one of:

```text
ACTIVE   -> and p.archived = false
ARCHIVED -> and p.archived = true
ALL      -> no archive predicate
```

Apply the same archived check in `CatalogService.product(id, true)`.
Pass `ProductArchiveStatus.ACTIVE` from `MiniCatalogController`; accept
`@RequestParam(defaultValue = "ACTIVE") ProductArchiveStatus archiveStatus`
in `AdminCatalogController` and forward it through `CatalogService.products`.

- [ ] **Step 4: Add service archive/restore methods and response fields**

Extend `ProductView` with:

```java
boolean archived,
Instant archivedAt,
Long archivedBy
```

Implement:

```java
@Transactional
public ProductView archive(
    long id,
    CurrentPrincipal actor,
    String requestId
) {
    Product product = repository.product(id).orElseThrow(EntityNotFoundException::new);
    if (product.archive(actor.id())) {
        auditService.record(actor, "PRODUCT_ARCHIVE", "PRODUCT",
            Long.toString(id), product.getName(), requestId);
    }
    return ProductView.from(product, inventoryRepository.current(id));
}

@Transactional
public ProductView restore(
    long id,
    CurrentPrincipal actor,
    String requestId
) {
    Product product = repository.product(id).orElseThrow(EntityNotFoundException::new);
    if (product.restore(actor.id())) {
        auditService.record(actor, "PRODUCT_RESTORE", "PRODUCT",
            Long.toString(id), product.getName(), requestId);
    }
    return ProductView.from(product, inventoryRepository.current(id));
}
```

- [ ] **Step 5: Add controller routes and checkout guard**

Add `archiveStatus` to admin list parameters and these routes:

```java
@DeleteMapping("/products/{id}")
ApiResponse<CatalogService.ProductView> archive(...)

@PostMapping("/products/{id}/restore")
ApiResponse<CatalogService.ProductView> restore(...)
```

In `OrderApplicationService.create`, require both conditions:

```java
.filter(product -> product.isOnShelf() && !product.isArchived())
.orElseThrow(() -> new BusinessException(
    "PRODUCT_UNAVAILABLE",
    "部分商品已下架，请移除后重试",
    HttpStatus.CONFLICT
));
```

- [ ] **Step 6: Verify focused API tests and commit**

Run:

```powershell
cd server
.\mvnw.cmd -Dtest=CatalogApiTest,MiniOrderControllerTest test
```

Expected: PASS.

```powershell
git add -- server/src/main/java/com/luneng/smartstore/catalog server/src/main/java/com/luneng/smartstore/order/OrderApplicationService.java server/src/test/java/com/luneng/smartstore/catalog/CatalogApiTest.java server/src/test/java/com/luneng/smartstore/order/MiniOrderControllerTest.java
git commit -m "feat: archive and restore products through API"
```

### Task 3: Add deleted-product filtering and actions to the admin product page

**Files:**
- Modify: `admin/src/api/catalog.ts:12-85`
- Modify: `admin/src/views/catalog/ProductView.vue:1-390`
- Modify: `admin/tests/ProductView.spec.ts`

**Interfaces:**
- Consumes: Task 2 admin API and `ProductView.archived` fields.
- Produces: typed archive filter, delete confirmation/action and restore action.

- [ ] **Step 1: Write failing API and component tests**

Extend the API mock with `archiveProduct` and `restoreProduct`, then assert:

```ts
await archiveButton.trigger('click')
await flushPromises()
expect(catalogApi.archiveProduct).toHaveBeenCalledWith(10)

await wrapper.get('[data-test="product-archive-filter"]').setValue('ARCHIVED')
await wrapper.get('[data-test="product-search"]').trigger('click')
expect(catalogApi.listProducts).toHaveBeenLastCalledWith(
  expect.objectContaining({ archiveStatus: 'ARCHIVED' }),
)

await restoreButton.trigger('click')
await flushPromises()
expect(catalogApi.restoreProduct).toHaveBeenCalledWith(10)
```

Assert archived rows do not show edit or shelf actions and that delete confirmation contains `历史订单不会受影响`.

- [ ] **Step 2: Run the focused admin test and verify failure**

Run:

```powershell
cd admin
npm test -- ProductView.spec.ts
```

Expected: FAIL because API methods, filter and actions are absent.

- [ ] **Step 3: Extend admin catalog types and API functions**

Add:

```ts
export type ProductArchiveStatus = 'ACTIVE' | 'ARCHIVED' | 'ALL'

export interface Product {
  // existing fields
  archived: boolean
  archivedAt: string | null
  archivedBy: number | null
}

export interface ProductQuery {
  // existing fields
  archiveStatus?: ProductArchiveStatus
}

export const archiveProduct = (id: number): Promise<Product> =>
  request(`/api/admin/products/${id}`, { method: 'DELETE' })

export const restoreProduct = (id: number): Promise<Product> =>
  request(`/api/admin/products/${id}/restore`, { method: 'POST' })
```

Include `archiveStatus` in the query string.

- [ ] **Step 4: Implement the approved low-emphasis delete and restore UI**

Extend filters with `archiveStatus: 'ACTIVE'` and add options `正常商品`, `已删除商品`, `全部商品`. The delete operation uses a link-style danger action and this confirmation text:

```ts
await ElMessageBox.confirm(
  '删除后商品将立即下架，顾客无法继续购买；历史订单不会受影响。',
  '确认删除商品',
  {
    confirmButtonText: '确认删除',
    cancelButtonText: '取消',
    type: 'warning',
  },
)
```

For archived rows show only `恢复`. After successful restore show `商品已恢复，请检查库存、价格和图片后手动上架` and reload the current filtered page.

- [ ] **Step 5: Verify tests, type checking and production build**

Run:

```powershell
cd admin
npm test -- ProductView.spec.ts
npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit the admin slice**

```powershell
git add -- admin/src/api/catalog.ts admin/src/views/catalog/ProductView.vue admin/tests/ProductView.spec.ts
git commit -m "feat: manage archived products in admin"
```

### Task 4: Verify customer-side removal, stale-cart rejection and historical-order safety

**Files:**
- Modify: `mini/tests/product-catalog-visibility.spec.ts`
- Modify: `mini/tests/checkout.spec.ts`
- Modify: `server/src/test/java/com/luneng/smartstore/e2e/OrderLifecycleE2ETest.java`
- Modify: `server/src/test/java/com/luneng/smartstore/audit/AdminAuditControllerTest.java`

**Interfaces:**
- Consumes: Task 2 public filtering/error behavior and existing mini checkout error display.
- Produces: regression proof that all customer surfaces and historical order paths remain correct.

- [ ] **Step 1: Add failing end-to-end regression assertions**

Add a server test with concrete persistence assertions:

```java
@Test
void archivedProductDisappearsFromCatalogWithoutChangingHistoricalOrder() {
    OrderView completed = createAndCompleteOrderForProduct(10L);
    catalogService.archive(10L, owner, "archive-history-product");

    assertThatThrownBy(() -> catalogService.product(10L, true))
        .isInstanceOf(EntityNotFoundException.class);

    OrderView historical = customerOrders.detail(
        completedCustomerId,
        completed.orderNo()
    );
    assertThat(historical.items()).singleElement().satisfies(item -> {
        assertThat(item.productName()).isEqualTo("无糖乌龙茶 500ml");
        assertThat(item.quantity()).isEqualTo(1);
        assertThat(item.unitPriceCent()).isEqualTo(500);
        assertThat(item.subtotalCent()).isEqualTo(500);
    });
    assertThat(historical.pickupCode()).matches("\\d{6}");
    assertThat(jdbcTemplate.queryForObject(
        "select count(*) from operation_log where action = 'PRODUCT_ARCHIVE' and object_id = '10'",
        Integer.class
    )).isEqualTo(1);
}
```

Implement `createAndCompleteOrderForProduct` using the existing order-lifecycle
test setup and status methods already present in `OrderLifecycleE2ETest`; keep the
assertions above unchanged.

Add mini tests that a rejected `orders.create` with `部分商品已下架，请移除后重试` does not clear the cart and that the checkout page displays the same message through its existing toast/error banner.

- [ ] **Step 2: Run focused regression tests**

Run:

```powershell
cd server
.\mvnw.cmd -Dtest=OrderLifecycleE2ETest,AdminAuditControllerTest test
cd ..\mini
npm test -- product-catalog-visibility.spec.ts checkout.spec.ts
```

Expected: PASS after Tasks 1-3; any failure identifies a customer or historical-data regression that must be fixed before proceeding.

- [ ] **Step 3: Run all project verification commands**

Run:

```powershell
cd server
.\mvnw.cmd test
cd ..\admin
npm test
npm run build
cd ..\mini
npm test
npm run typecheck
```

Expected: every suite passes and the existing out-of-stock ordering behavior remains unchanged for active products.

- [ ] **Step 4: Commit regression coverage**

```powershell
git add -- server/src/test/java/com/luneng/smartstore/e2e/OrderLifecycleE2ETest.java server/src/test/java/com/luneng/smartstore/audit/AdminAuditControllerTest.java mini/tests/product-catalog-visibility.spec.ts mini/tests/checkout.spec.ts
git commit -m "test: cover archived product customer behavior"
```
