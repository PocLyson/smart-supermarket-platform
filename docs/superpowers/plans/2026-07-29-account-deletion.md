# Customer Account Deletion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a customer-initiated account deletion flow that blocks deletion while an order is unfinished, removes profile and login identifiers, invalidates sessions, preserves legally required order records, and clears local mini-program data.

**Architecture:** A transactional Spring service owns the deletion rules and customer tombstoning. A protected `DELETE /api/mini/account` endpoint invokes it and invalidates every indexed customer session. The mini program exposes a two-step confirmation flow, calls the endpoint, then clears session, cart, pending checkout, and search data from local storage.

**Tech Stack:** Java 17, Spring Boot 3, Spring Security, Spring Data JPA, Redis, MySQL/Flyway, WeChat Mini Program TypeScript/WXML/WXSS, Vitest, JUnit 5/MockMvc.

## Global Constraints

- Do not delete `customer_order` rows or legally required order history.
- Treat `PENDING_CONFIRMATION`, `PREPARING`, and `READY_FOR_PICKUP` as unfinished.
- Clear `pickup_name`, `phone`, nickname, avatar, and the reusable OpenID value from the deleted customer row.
- Preserve the customer row as a disabled tombstone so historical foreign keys remain valid.
- Invalidate all sessions indexed for the customer.
- Do not modify unrelated existing UI or legal changes.
- Write and observe each failing test before implementation.

---

### Task 1: Backend deletion domain and endpoint

**Files:**
- Create: `server/src/main/java/com/luneng/smartstore/customer/CustomerAccountService.java`
- Create: `server/src/main/java/com/luneng/smartstore/customer/CustomerAccountController.java`
- Modify: `server/src/main/java/com/luneng/smartstore/customer/CustomerUser.java`
- Modify: `server/src/main/java/com/luneng/smartstore/order/OrderRepository.java`
- Modify: `server/src/main/java/com/luneng/smartstore/auth/SecurityConfig.java`
- Test: `server/src/test/java/com/luneng/smartstore/customer/CustomerAccountControllerTest.java`

**Interfaces:**
- Consumes: authenticated `CurrentPrincipal`, `CustomerUserRepository`, `OrderRepository`, `StringRedisTemplate`.
- Produces: `DELETE /api/mini/account`; `CustomerAccountService.delete(long customerId)`.

- [ ] **Step 1: Write failing integration tests**

Test that unfinished orders return HTTP 409 with `ACCOUNT_HAS_ACTIVE_ORDERS`. Test that a customer with only terminal orders receives HTTP 200, has profile fields cleared, has `enabled=false`, receives a non-reusable tombstone OpenID, and loses the current Redis session.

- [ ] **Step 2: Run the focused server test and verify RED**

Run:

```powershell
.\mvnw.cmd -Dtest=CustomerAccountControllerTest test
```

Expected: compilation or assertion failure because the endpoint and deletion behavior do not exist.

- [ ] **Step 3: Implement the minimal backend behavior**

Add:

```java
boolean existsByCustomerIdAndStatusIn(long customerId, Collection<OrderStatus> statuses);
```

Add `CustomerUser.deactivate(String tombstoneOpenid)` to replace OpenID and clear nickname, avatar, pickup name and phone before disabling the row.

Add transactional deletion logic:

```java
if (orders.existsByCustomerIdAndStatusIn(customerId, ACTIVE_STATUSES)) {
    throw new BusinessException(
        "ACCOUNT_HAS_ACTIVE_ORDERS",
        "存在未完成订单，请完成或取消后再注销账号",
        HttpStatus.CONFLICT
    );
}
customer.deactivate("deleted:" + customer.getId() + ":" + UUID.randomUUID());
invalidateCustomerSessions(customerId);
```

Protect `/api/mini/account` with `ROLE_CUSTOMER`.

- [ ] **Step 4: Run the focused server test and verify GREEN**

Run:

```powershell
.\mvnw.cmd -Dtest=CustomerAccountControllerTest test
```

Expected: all focused tests pass.

### Task 2: Index and invalidate all customer sessions

**Files:**
- Modify: `server/src/main/java/com/luneng/smartstore/customer/CustomerAuthService.java`
- Modify: `server/src/main/java/com/luneng/smartstore/customer/CustomerAccountService.java`
- Test: `server/src/test/java/com/luneng/smartstore/customer/CustomerAuthControllerTest.java`
- Test: `server/src/test/java/com/luneng/smartstore/customer/CustomerAccountControllerTest.java`

**Interfaces:**
- Produces Redis set `auth:customer-sessions:<customerId>` containing active session IDs.
- Deletion removes each `auth:session:<sessionId>` key and the customer session set.

- [ ] **Step 1: Add failing assertions for session indexing and invalidation**

Verify login adds the issued session ID to the customer session set. Verify deletion removes two independently created session keys for the same customer.

- [ ] **Step 2: Run focused tests and verify RED**

```powershell
.\mvnw.cmd -Dtest=CustomerAuthControllerTest,CustomerAccountControllerTest test
```

- [ ] **Step 3: Implement session indexing**

After creating the session key, add the session ID to `auth:customer-sessions:<customerId>` and apply `JwtService.TOKEN_TTL` to the set. During deletion, read set members, delete their session keys, then delete the set.

- [ ] **Step 4: Run focused tests and verify GREEN**

Use the same Maven command and require zero failures.

### Task 3: Mini-program API and two-step deletion flow

**Files:**
- Modify: `mini/miniprogram/services/http.ts`
- Modify: `mini/miniprogram/services/auth.ts`
- Modify: `mini/miniprogram/pages/profile/presentation.ts`
- Modify: `mini/miniprogram/pages/profile/index.ts`
- Modify: `mini/miniprogram/pages/profile/index.wxml`
- Modify: `mini/miniprogram/pages/profile/index.wxss`
- Modify: `mini/miniprogram/store/cart.ts`
- Test: `mini/tests/http.spec.ts`
- Test: `mini/tests/profile.spec.ts`
- Test: `mini/tests/cart.spec.ts`

**Interfaces:**
- Add `HttpClient.delete<T>(path, data?, headers?)`.
- Add `profileService.deleteAccount(): Promise<void>`.
- Add `confirmAccountDeletion(showModal): Promise<boolean>`.
- Add `Cart.clear(): void`.

- [ ] **Step 1: Write failing Vitest tests**

Test DELETE transport behavior, authenticated deletion service call, two consecutive confirmation requirements, cancellation at either modal, and clearing an in-memory cart.

- [ ] **Step 2: Run focused mini tests and verify RED**

```powershell
npm test -- --run tests/http.spec.ts tests/profile.spec.ts tests/cart.spec.ts
```

- [ ] **Step 3: Implement mini-program behavior**

Add a restrained “注销账号” action below logout. On tap:

1. Explain unfinished-order blocking and legal record retention.
2. Require a second destructive confirmation.
3. Call `DELETE /api/mini/account`.
4. Clear cart and all mini-program local storage only after server success.
5. Return the profile page to the logged-out state and show a success toast.
6. Preserve the session and show the server error if deletion is blocked or fails.

- [ ] **Step 4: Run focused mini tests and verify GREEN**

Use the same Vitest command and require zero failures.

### Task 4: Legal text, review checklist, and full verification

**Files:**
- Modify: `mini/miniprogram/pages/legal/index.ts`
- Modify: `docs/release/wechat-privacy-guide-copy.md`
- Modify: `docs/release/wechat-privacy-guide-checklist.md`
- Test: `mini/tests/legal-content.spec.ts`

**Interfaces:**
- Legal copy must accurately distinguish profile deletion from legally required order-record retention.

- [ ] **Step 1: Update the legal content regression test**

Assert the privacy document mentions the online path “我的—注销账号”, unfinished-order handling, and retained statutory transaction records.

- [ ] **Step 2: Run the legal test and verify RED**

```powershell
npm test -- --run tests/legal-content.spec.ts
```

- [ ] **Step 3: Update public and operational text**

Replace the store-only cancellation instructions with the online flow while keeping phone, email and in-store channels available.

- [ ] **Step 4: Run all verification**

```powershell
cd server
.\mvnw.cmd test
cd ..\mini
npm run typecheck
npm test -- --run
cd ..
git diff --check
```

Expected: Maven, TypeScript, all Vitest suites and diff validation pass.
