# Admin Order Archive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let staff filter, inspect, and restore orders archived from the admin order list while keeping those orders hidden from the mini program.

**Architecture:** Keep the existing `admin_hidden` soft-delete flag as the source of truth. Extend only the authenticated admin list/detail/restore flow: list queries select either active or archived records, admin detail can read either, and restore clears `admin_hidden` with an audit record. Customer queries remain unchanged and therefore never expose the admin archive.

**Tech Stack:** Java 17, Spring Boot 3, Spring Data JPA, MockMvc, Vue 3, TypeScript, Element Plus, Vitest.

## Global Constraints

- Preserve existing customer visibility and order status semantics.
- Restoring an order changes only `admin_hidden`; it must not change order status, payment, inventory, or customer visibility.
- Only completed or cancelled orders can enter the archive through the existing archive operation.
- Preserve unrelated changes in the dirty worktree and do not create a commit unless the user requests one.

---

### Task 1: Backend archive query and restore

**Files:**
- Modify: `server/src/test/java/com/luneng/smartstore/order/AdminOrderWorkflowTest.java`
- Modify: `server/src/main/java/com/luneng/smartstore/order/CustomerOrder.java`
- Modify: `server/src/main/java/com/luneng/smartstore/order/OrderRepository.java`
- Modify: `server/src/main/java/com/luneng/smartstore/order/AdminOrderService.java`
- Modify: `server/src/main/java/com/luneng/smartstore/order/AdminOrderController.java`

**Interfaces:**
- Consumes: existing `customer_order.admin_hidden` boolean column.
- Produces: `GET /api/admin/orders?archived=true`, archive-aware admin detail, and `POST /api/admin/orders/{orderNo}/restore`.

- [ ] **Step 1: Write the failing integration test**

Extend `adminCanArchiveTerminalOrderWithoutHidingItFromCustomer` to assert the archived list contains the order, the archived detail is readable, the restore endpoint succeeds, the active list contains the order again, and the customer list remains unchanged.

- [ ] **Step 2: Run the test to verify it fails**

Run: `.\mvnw.cmd -Dtest=AdminOrderWorkflowTest test`

Expected: compilation or assertion failure because the list has no `archived` argument and the restore route does not exist.

- [ ] **Step 3: Implement the minimal backend behavior**

Add `CustomerOrder.restoreForAdmin()`, change `OrderRepository.searchAdmin(...)` to compare `o.adminHidden = :archived`, allow admin detail lookup regardless of archive flag, extend `AdminOrderService.list(...)` with `boolean archived`, and add `AdminOrderService.restore(...)` that records `ORDER_RESTORE`. Add the controller query parameter and restore route.

- [ ] **Step 4: Run the focused backend test**

Run: `.\mvnw.cmd -Dtest=AdminOrderWorkflowTest test`

Expected: all `AdminOrderWorkflowTest` tests pass.

### Task 2: Admin archived filter and restore action

**Files:**
- Modify: `admin/tests/OrderWorkflow.spec.ts`
- Modify: `admin/src/api/orders.ts`
- Modify: `admin/src/views/orders/OrderListView.vue`
- Modify: `admin/src/views/audit/AuditLogView.vue`

**Interfaces:**
- Consumes: `archived?: boolean` query and `POST /api/admin/orders/{orderNo}/restore`.
- Produces: “已归档” tab, archived-only list state, desktop/mobile restore actions, and a readable restore audit label.

- [ ] **Step 1: Write failing component tests**

Add one test that selects the “已归档” tab and expects `listOrders` to receive `archived: true`, and one test that clicks “恢复” and expects `restoreOrder(orderNo)` followed by a list refresh. Update the active-list query expectation to include `archived: false`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- --run tests/OrderWorkflow.spec.ts`

Expected: failures because the archived filter, restore API, and restore buttons do not exist.

- [ ] **Step 3: Implement the minimal admin behavior**

Add `archived?: boolean` to `AdminOrderQuery`, add `restoreOrder(orderNo)`, track `filters.archived`, render an “已归档” tab, pass the flag to `listOrders`, and render “恢复” instead of “删除” while browsing archived orders. Add `ORDER_RESTORE: '恢复归档订单'` to the audit label map.

- [ ] **Step 4: Run focused admin tests**

Run: `npm test -- --run tests/OrderWorkflow.spec.ts tests/AuditLogView.spec.ts`

Expected: all focused tests pass.

### Task 3: Full regression verification

**Files:**
- Verify only; no planned production edits.

**Interfaces:**
- Consumes: completed backend and admin changes.
- Produces: evidence that backend, admin, and mini-program behavior remain valid.

- [ ] **Step 1: Run backend regression tests**

Run: `.\mvnw.cmd test`

Expected: all backend tests pass.

- [ ] **Step 2: Run admin regression tests and build**

Run: `npm test -- --run`

Run: `npm run build`

Expected: all admin tests pass and the production build exits successfully.

- [ ] **Step 3: Run mini-program regression tests**

Run: `npm test -- --run`

Run: `npm run typecheck`

Expected: all mini-program tests and TypeScript checks pass without exposing archived orders.
