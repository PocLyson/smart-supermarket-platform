# Pickup Code Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require staff to enter the customer’s six-digit pickup code before a paid, ready-for-pickup order can be completed.

**Architecture:** Keep the deterministic six-digit code derived from the order number as the single source of truth. The admin completion endpoint accepts a validated code and verifies it inside the locked order transaction; a mismatch leaves status unchanged and returns a business error. Mini-program responses continue to expose the customer code, while admin responses omit it and the admin UI asks staff to enter the code in the completion dialog.

**Tech Stack:** Java 17, Spring Boot 3, Jakarta Bean Validation, Spring Data JPA, MockMvc, Vue 3, TypeScript, Element Plus, Vitest.

## Global Constraints

- Only `READY_FOR_PICKUP` and `PAID` orders can be completed.
- Pickup code must contain exactly six digits.
- Incorrect codes must not change order state or create an `ORDER_COMPLETE` audit record.
- Customer mini-program order detail continues to show the pickup code.
- Admin list/detail/mutation responses must not reveal the full pickup code.

---

### Task 1: Backend pickup-code enforcement

**Files:**
- Create: `server/src/main/java/com/luneng/smartstore/order/PickupCode.java`
- Create: `server/src/main/java/com/luneng/smartstore/order/AdminOrderView.java`
- Modify: `server/src/test/java/com/luneng/smartstore/order/AdminOrderWorkflowTest.java`
- Modify: `server/src/main/java/com/luneng/smartstore/order/OrderView.java`
- Modify: `server/src/main/java/com/luneng/smartstore/order/CustomerOrder.java`
- Modify: `server/src/main/java/com/luneng/smartstore/order/AdminOrderService.java`
- Modify: `server/src/main/java/com/luneng/smartstore/order/AdminOrderController.java`

**Interfaces:**
- Consumes: deterministic six-digit code derived from `orderNo`.
- Produces: `POST /api/admin/orders/{orderNo}/complete` body `{ "pickupCode": "123456" }`.

- [ ] Add failing integration tests for missing, malformed, incorrect, and correct pickup codes.
- [ ] Verify tests fail because the endpoint ignores or does not accept a code.
- [ ] Extract `PickupCode.fromOrderNo(String)`, validate inside `CustomerOrder.complete(long, String)`, and keep all state checks transactional.
- [ ] Add `AdminOrderView` without `pickupCode` and return it from all admin order endpoints.
- [ ] Run `.\mvnw.cmd -Dtest=AdminOrderWorkflowTest test`.

### Task 2: Admin pickup-code entry

**Files:**
- Modify: `admin/tests/OrderWorkflow.spec.ts`
- Modify: `admin/src/api/orders.ts`
- Modify: `admin/src/views/orders/OrderDetailView.vue`

**Interfaces:**
- Consumes: completion body `{ pickupCode: string }` and backend mismatch error.
- Produces: six-digit numeric input in the completion dialog and a disabled submit action until valid.

- [ ] Add failing component tests proving completion requires six digits and sends the entered code.
- [ ] Verify tests fail against the current no-input completion flow.
- [ ] Remove `pickupCode` from admin response types and the visible backend code card.
- [ ] Add the completion input, client-side validation, request payload, and inline mismatch error.
- [ ] Run `npm test -- --run tests/OrderWorkflow.spec.ts` and `npm run build`.

### Task 3: Full verification and local runtime

**Files:**
- Verify only.

**Interfaces:**
- Consumes: completed backend and admin changes.
- Produces: validated local test environment.

- [ ] Run `.\mvnw.cmd test`.
- [ ] Run admin full tests and production build.
- [ ] Run mini-program full tests and TypeScript checks.
- [ ] Restart the local API and confirm `/actuator/health` reports `UP`.
