# Product Permanent Delete Implementation Plan

> **For Codex:** Execute this plan task-by-task with test-driven development and verify every destructive-path constraint before completion.

**Goal:** Let owners permanently delete archived products that have never appeared in an order, while preserving order history and safely cleaning product-owned data.

**Architecture:** Add an owner-only permanent-delete endpoint to the existing catalog service. The service locks the product, rejects active or historically ordered products, records an audit entry, removes inventory rows and the product in one transaction, then removes an unshared local image after commit. The admin archived-products view exposes a danger action with an irreversible confirmation dialog.

**Tech Stack:** Spring Boot, JPA/JdbcTemplate, MySQL, Vue 3, TypeScript, Element Plus, JUnit/MockMvc, Vitest.

---

### Task 1: Specify permanent-delete server behavior

**Files:**
- Modify: `server/src/test/java/com/luneng/smartstore/catalog/CatalogApiTest.java`

**Steps:**
1. Add failing API tests proving only archived products can be permanently deleted.
2. Add a failing test proving products referenced by `order_item` return HTTP 409 and remain intact.
3. Add a failing test proving inventory and ledger rows are removed for an eligible product.
4. Add a failing authorization test proving cashiers receive HTTP 403.
5. Run `./mvnw -q -Dtest=CatalogApiTest test` from `server` and confirm the new tests fail for the missing endpoint.

### Task 2: Implement transactional deletion and safe image cleanup

**Files:**
- Modify: `server/src/main/java/com/luneng/smartstore/catalog/AdminCatalogController.java`
- Modify: `server/src/main/java/com/luneng/smartstore/catalog/CatalogService.java`
- Modify: `server/src/main/java/com/luneng/smartstore/catalog/CatalogRepository.java`
- Modify: `server/src/main/java/com/luneng/smartstore/inventory/InventoryRepository.java`
- Modify: `server/src/main/java/com/luneng/smartstore/file/ImageStorageService.java`
- Test: `server/src/test/java/com/luneng/smartstore/catalog/CatalogApiTest.java`

**Steps:**
1. Add `DELETE /api/admin/products/{id}/permanent` returning a deletion result.
2. Lock the product and reject non-archived products with `PRODUCT_NOT_ARCHIVED`.
3. Reject products referenced by order items with `PRODUCT_HAS_ORDER_HISTORY`.
4. Record `PRODUCT_PERMANENT_DELETE`, remove ledger/inventory rows, then remove the product.
5. Detect whether the local cover image is shared; if unshared, schedule deletion after transaction commit.
6. Run the focused server tests until green.

### Task 3: Add permanent-delete action to the archived-products UI

**Files:**
- Modify: `admin/src/api/catalog.ts`
- Modify: `admin/src/views/catalog/ProductView.vue`
- Modify: `admin/tests/ProductView.spec.ts`

**Steps:**
1. Add failing UI tests for archived-row visibility, cancellation, confirmation, API invocation, and success refresh.
2. Add the typed permanent-delete API request.
3. Show `永久删除` only beside archived products on desktop and mobile.
4. Require an irreversible warning confirmation and reuse the row-level pending guard.
5. Keep the archived filter/page after success and show `商品已永久删除`.
6. Run `npm test -- --run admin/tests/ProductView.spec.ts` and `npm run build` from `admin`.

### Task 4: Regression, restart, and handoff

**Files:**
- Verify only; no planned source changes.

**Steps:**
1. Run the full server test suite.
2. Run the full admin test suite and production build.
3. Review `git diff` and ensure unrelated user files are untouched.
4. Commit only the permanent-delete implementation and plan.
5. Restart the local API on port 8080 and smoke-test health.
6. Ask the user to test one eligible archived product and one product with order history.
