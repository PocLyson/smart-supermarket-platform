# Merchant Foundation and Orders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an independently runnable merchant mini program with staff-WeChat binding, client-scoped authorization, order workbench, fulfillment, pay-at-store, and pickup verification.

**Architecture:** Extend JWT principals with an explicit client type so admin-web, customer-mini, and merchant-mini sessions cannot cross API boundaries. Add merchant adapters over existing staff/order/inventory/audit services, then build a separate native WeChat mini program that copies the approved customer UI tokens and uses its own session store.

**Tech Stack:** Java 17, Spring Boot 3.5.9, Spring Security, JPA/JdbcTemplate, Redis, MySQL/Flyway, native WeChat Mini Program TypeScript, TDesign MiniProgram 1.15.3, Vitest 4, Testcontainers.

## Global Constraints

- Bottom navigation is `工作台｜订单｜核销｜消息｜我的`; Phase 1 ships “消息” as a disabled empty state saying “客服功能正在建设” rather than a broken route.
- Copy the exact navy/neutral tokens from `mini/miniprogram/styles/theme.wxss` and test equality.
- `OWNER` can cancel; `CASHIER` cannot. Both can accept, mark ready, confirm pay-at-store, and verify pickup.
- Merchant endpoints require both a staff role and `ClientType.MERCHANT_MINI`.
- Existing admin and customer tokens must continue to work only in their own clients.

---

### Task 1: Client-Scoped Principal and Merchant WeChat Binding

**Files:**
- Create: `server/src/main/resources/db/migration/V7__create_staff_wechat_binding.sql`
- Create: `server/src/main/java/com/luneng/smartstore/auth/ClientType.java`
- Modify: `server/src/main/java/com/luneng/smartstore/auth/CurrentPrincipal.java`
- Modify: `server/src/main/java/com/luneng/smartstore/auth/JwtService.java`
- Modify: `server/src/main/java/com/luneng/smartstore/auth/JwtAuthenticationFilter.java`
- Modify: `server/src/main/java/com/luneng/smartstore/auth/SecurityConfig.java`
- Create: `server/src/main/java/com/luneng/smartstore/merchantauth/StaffWechatBinding.java`
- Create: `server/src/main/java/com/luneng/smartstore/merchantauth/StaffWechatBindingRepository.java`
- Create: `server/src/main/java/com/luneng/smartstore/merchantauth/MerchantWechatSessionClient.java`
- Create: `server/src/main/java/com/luneng/smartstore/merchantauth/MerchantAuthService.java`
- Create: `server/src/main/java/com/luneng/smartstore/merchantauth/MerchantAuthController.java`
- Modify: `server/src/main/resources/application.yml`
- Test: `server/src/test/java/com/luneng/smartstore/merchantauth/MerchantAuthApiTest.java`
- Test: `server/src/test/java/com/luneng/smartstore/auth/ClientTypeSecurityTest.java`

**Interfaces:**
- Produces: `ClientType { ADMIN_WEB, CUSTOMER_MINI, MERCHANT_MINI }`.
- Produces: `MerchantAuthService.passwordLogin(String username, String rawPassword, String code)` and `wechatLogin(String code)` returning `MerchantSessionView(accessToken, role, staffId, username, expiresAt)`.
- Produces: `POST /api/merchant-mini/auth/password-login`, `POST /api/merchant-mini/auth/wechat-login`, `POST /api/merchant-mini/auth/logout`, `GET /api/merchant-mini/account`, `DELETE /api/merchant-mini/account/wechat-binding`.

- [ ] **Step 1: Write the migration and failing binding/auth tests**

```sql
create table staff_wechat_binding (
  id bigint primary key auto_increment,
  staff_id bigint not null,
  app_id varchar(64) not null,
  openid varchar(128) not null,
  enabled boolean not null default true,
  bound_at timestamp not null default current_timestamp,
  last_login_at timestamp null,
  unbound_at timestamp null,
  constraint fk_staff_wechat_binding_staff foreign key (staff_id) references staff_account(id),
  constraint uk_staff_wechat_binding_staff unique (staff_id),
  constraint uk_staff_wechat_binding_openid unique (app_id, openid)
);
```

Test cases must cover first bind, same WeChat bound twice, same staff bound to another WeChat, disabled staff, shortcut login, unbind, and admin/customer token rejection on merchant paths.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `cd server; .\mvnw.cmd -Dtest=MerchantAuthApiTest,ClientTypeSecurityTest test`

Expected: FAIL because the migration, controllers, and `clientType` claim do not exist.

- [ ] **Step 3: Implement client-scoped JWT and binding**

```java
public enum ClientType { ADMIN_WEB, CUSTOMER_MINI, MERCHANT_MINI }

public record CurrentPrincipal(
    long id, ActorType actorType, String role, String sessionId, ClientType clientType
) {
    public CurrentPrincipal(long id, ActorType actorType, String role, String sessionId) {
        this(id, actorType, role, sessionId,
            actorType == ActorType.CUSTOMER ? ClientType.CUSTOMER_MINI : ClientType.ADMIN_WEB);
    }
}
```

Issue and parse `clientType` in `JwtService`; add `CLIENT_<type>` authority in `JwtAuthenticationFilter`. Permit only merchant auth endpoints publicly and require `ROLE_OWNER|ROLE_CASHIER` plus `CLIENT_MERCHANT_MINI` for the rest of `/api/merchant-mini/**`.

Configure exact keys:

```yaml
smart-store:
  merchant-wechat:
    app-id: ${MERCHANT_WECHAT_APP_ID:touristappid}
    app-secret: ${MERCHANT_WECHAT_APP_SECRET:local-dev-only}
    local-mock-enabled: ${MERCHANT_WECHAT_LOCAL_MOCK_ENABLED:false}
    local-mock-openid: ${MERCHANT_WECHAT_LOCAL_MOCK_OPENID:local-dev-staff}
```

Store one active merchant session per staff ID in Redis key `auth:merchant-staff:{staffId}` and invalidate its `auth:session:{sessionId}` value on re-login, unbind, password reset, or staff disable.

- [ ] **Step 4: Run focused and existing auth tests**

Run: `cd server; .\mvnw.cmd -Dtest=MerchantAuthApiTest,ClientTypeSecurityTest,StaffAuthControllerTest,CustomerAuthControllerTest,SecurityCorsTest test`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add server/src/main/resources/db/migration/V7__create_staff_wechat_binding.sql server/src/main/java/com/luneng/smartstore/auth server/src/main/java/com/luneng/smartstore/merchantauth server/src/main/resources/application.yml server/src/test/java/com/luneng/smartstore/merchantauth server/src/test/java/com/luneng/smartstore/auth/ClientTypeSecurityTest.java
git commit -m "feat: add merchant staff wechat authentication"
```

### Task 2: Merchant Dashboard and Order Adapter

**Files:**
- Create: `server/src/main/java/com/luneng/smartstore/merchant/MerchantDashboardService.java`
- Create: `server/src/main/java/com/luneng/smartstore/merchant/MerchantDashboardController.java`
- Create: `server/src/main/java/com/luneng/smartstore/merchant/MerchantOrderService.java`
- Create: `server/src/main/java/com/luneng/smartstore/merchant/MerchantOrderController.java`
- Modify: `server/src/main/java/com/luneng/smartstore/order/AdminOrderService.java`
- Modify: `server/src/main/java/com/luneng/smartstore/order/CustomerOrder.java`
- Test: `server/src/test/java/com/luneng/smartstore/merchant/MerchantOrderApiTest.java`
- Test: `server/src/test/java/com/luneng/smartstore/merchant/MerchantDashboardApiTest.java`

**Interfaces:**
- Produces: `DashboardView(Map<OrderStatus, Long> orderCounts, long lowStockCount, long waitingConversationCount, List<AdminOrderView> latestOrders)`; waiting conversations is `0` until Phase 4.
- Produces: merchant order list/detail/accept/ready/cancel endpoints mirroring existing admin semantics.
- Produces: `POST /api/merchant-mini/orders/{orderNo}/verify-pickup` with `VerifyPickupRequest(String pickupCode, PaymentMethod payAtStoreMethod)`.

- [ ] **Step 1: Write failing API tests for permissions and atomic pickup**

```java
mockMvc.perform(post("/api/merchant-mini/orders/{orderNo}/verify-pickup", orderNo)
        .with(merchantCashier())
        .header("X-Request-Id", "merchant-pickup-1")
        .contentType(APPLICATION_JSON)
        .content("""{"pickupCode":"473898","payAtStoreMethod":"CASH"}"""))
    .andExpect(status().isOk())
    .andExpect(jsonPath("$.data.status").value("COMPLETED"))
    .andExpect(jsonPath("$.data.paymentStatus").value("PAID"));
```

Also assert `CASHIER` receives 403 on cancel, `OWNER` can cancel, invalid pickup code leaves payment `UNPAID`, and duplicate request ID returns the existing final view without duplicate history.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `cd server; .\mvnw.cmd -Dtest=MerchantOrderApiTest,MerchantDashboardApiTest test`

Expected: FAIL with missing merchant controllers.

- [ ] **Step 3: Implement thin merchant adapters**

```java
@Transactional
public AdminOrderView verifyPickup(
    String orderNo,
    String pickupCode,
    PaymentMethod payAtStoreMethod,
    CurrentPrincipal actor,
    String requestId
) {
    CustomerOrder order = repository.findLockedByOrderNo(orderNo).orElseThrow();
    order.verifyPickupCode(pickupCode);
    if (order.getPaymentStatus() == PaymentStatus.UNPAID) {
        order.markPaid(requirePayAtStoreMethod(payAtStoreMethod));
    }
    order.completeAfterVerified(actor.id());
    audit(actor, "ORDER_COMPLETE", order, "COMPLETED", requestId);
    return AdminOrderView.from(order);
}
```

Refactor `CustomerOrder.complete` into `verifyPickupCode` and `completeAfterVerified` while keeping the existing admin service behavior unchanged. Reuse `AdminOrderService` list/detail/accept/ready/cancel methods; do not copy state-transition rules.

- [ ] **Step 4: Run merchant and existing order suites**

Run: `cd server; .\mvnw.cmd -Dtest=MerchantOrderApiTest,MerchantDashboardApiTest,AdminOrderWorkflowTest,OrderConcurrencyTest,OrderLifecycleE2ETest test`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add server/src/main/java/com/luneng/smartstore/merchant server/src/main/java/com/luneng/smartstore/order server/src/test/java/com/luneng/smartstore/merchant
git commit -m "feat: expose merchant order workflow"
```

### Task 3: Merchant Mini Program Shell and Login

**Files:**
- Create: `merchant-mini/package.json`
- Create: `merchant-mini/tsconfig.json`
- Create: `merchant-mini/vitest.config.ts`
- Create: `merchant-mini/project.config.json`
- Create: `merchant-mini/miniprogram/app.ts`
- Create: `merchant-mini/miniprogram/app.json`
- Create: `merchant-mini/miniprogram/app.wxss`
- Create: `merchant-mini/miniprogram/config/env.ts`
- Create: `merchant-mini/miniprogram/styles/theme.wxss`
- Create: `merchant-mini/miniprogram/styles/components.wxss`
- Create: `merchant-mini/miniprogram/services/http.ts`
- Create: `merchant-mini/miniprogram/services/auth.ts`
- Create: `merchant-mini/miniprogram/store/session.ts`
- Create: `merchant-mini/miniprogram/components/app-tab-bar/*`
- Create: `merchant-mini/miniprogram/pages/login/*`
- Create: `merchant-mini/miniprogram/pages/profile/*`
- Create: `merchant-mini/miniprogram/pages/messages-unavailable/*`
- Test: `merchant-mini/tests/theme-contract.spec.ts`
- Test: `merchant-mini/tests/auth.spec.ts`
- Test: `merchant-mini/tests/navigation.spec.ts`

**Interfaces:**
- Consumes: Task 1 merchant auth endpoints.
- Produces: `MerchantSession { accessToken, role, staffId, username, expiresAt }` and `merchantHttp` with automatic bearer token and logout on 401.

- [ ] **Step 1: Write failing theme, auth-store, and navigation tests**

```ts
expect(readMerchantToken('--primary-600')).toBe(readCustomerToken('--primary-600'))
expect(NAV_ITEMS.map((item) => item.label)).toEqual([
  '工作台', '订单', '核销', '消息', '我的',
])
```

Test expired sessions are rejected, unauthorized responses clear only the merchant session key, and `CASHIER` never receives owner-only shortcuts.

- [ ] **Step 2: Run tests and verify failure**

Run: `cd merchant-mini; npm install; npm test -- --run`

Expected: FAIL because the project files do not exist.

- [ ] **Step 3: Implement the shell**

Use `touristappid` in committed `project.config.json`; the real merchant AppID is supplied locally before WeChat login integration. Copy exact theme token values from the customer theme and add an employee-header component rather than changing colors.

```ts
export interface MerchantSession {
  accessToken: string
  role: 'OWNER' | 'CASHIER'
  staffId: number
  username: string
  expiresAt: number
}
```

The login page calls `wx.login`, then `/api/merchant-mini/auth/wechat-login`; when the server returns `MERCHANT_NOT_BOUND`, show account/password fields and require confirmation before `/password-login`.

- [ ] **Step 4: Run merchant tests and typecheck**

Run: `cd merchant-mini; npm test -- --run; npm run typecheck`

Expected: all tests PASS and TypeScript exits 0.

- [ ] **Step 5: Commit**

```powershell
git add merchant-mini
git commit -m "feat: scaffold merchant mini program"
```

### Task 4: Workbench and Order Pages

**Files:**
- Create: `merchant-mini/miniprogram/types/order.ts`
- Create: `merchant-mini/miniprogram/types/dashboard.ts`
- Create: `merchant-mini/miniprogram/services/orders.ts`
- Create: `merchant-mini/miniprogram/services/dashboard.ts`
- Create: `merchant-mini/miniprogram/pages/workbench/*`
- Create: `merchant-mini/miniprogram/pages/orders/*`
- Create: `merchant-mini/miniprogram/pages/order-detail/*`
- Create: `merchant-mini/miniprogram/utils/order-reminder.ts`
- Modify: `merchant-mini/miniprogram/app.json`
- Test: `merchant-mini/tests/workbench.spec.ts`
- Test: `merchant-mini/tests/orders.spec.ts`
- Test: `merchant-mini/tests/order-reminder.spec.ts`

**Interfaces:**
- Consumes: Task 2 dashboard and order endpoints.
- Produces: `createOrderReminder({ pollMs: 15000, fetchSummary, onNewOrder })` with `start()`, `refreshNow()`, and `stop()`.

- [ ] **Step 1: Write failing presentation and reminder tests**

```ts
expect(findNewOrderIds(['A', 'B'], new Set(['A']))).toEqual(['B'])
expect(orderAction('PENDING_CONFIRMATION', 'CASHIER')).toBe('ACCEPT')
expect(orderAction('COMPLETED', 'OWNER')).toBeUndefined()
```

Cover status tabs, payment labels, phone masking, list-context restoration, foreground immediate refresh, and no repeated sound for the same order.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `cd merchant-mini; npm test -- --run tests/workbench.spec.ts tests/orders.spec.ts tests/order-reminder.spec.ts`

Expected: FAIL with missing modules.

- [ ] **Step 3: Implement workbench, order list, and detail**

Use `setInterval` only while the app is foregrounded; call `refreshNow()` from `App.onShow` and `stop()` from `App.onHide`. The order detail action must reload after every state mutation and show server error messages verbatim when they are safe Chinese business messages.

- [ ] **Step 4: Run merchant suite and typecheck**

Run: `cd merchant-mini; npm test -- --run; npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add merchant-mini/miniprogram merchant-mini/tests
git commit -m "feat: add merchant workbench and orders"
```

### Task 5: Pickup Verification Page

**Files:**
- Create: `merchant-mini/miniprogram/pages/verify-pickup/*`
- Modify: `merchant-mini/miniprogram/services/orders.ts`
- Modify: `merchant-mini/miniprogram/components/app-tab-bar/navigation.ts`
- Test: `merchant-mini/tests/pickup-verification.spec.ts`

**Interfaces:**
- Consumes: `POST /api/merchant-mini/orders/{orderNo}/verify-pickup`.
- Produces: `parsePickupScan(raw: string): { pickupCode: string }` accepting a plain six-digit code or the project’s signed QR payload format.

- [ ] **Step 1: Write failing scan, validation, and state tests**

```ts
expect(parsePickupScan('473898')).toEqual({ pickupCode: '473898' })
expect(() => parsePickupScan('12')).toThrow('请输入6位取货码')
```

Test online-paid orders omit payment controls, unpaid orders require `CASH` or `WECHAT_QR`, invalid codes never display success, and a successful result offers “继续核销” and “查看订单”.

- [ ] **Step 2: Run focused test and verify failure**

Run: `cd merchant-mini; npm test -- --run tests/pickup-verification.spec.ts`

Expected: FAIL with missing page logic.

- [ ] **Step 3: Implement scan then confirm flow**

Call `wx.scanCode({ scanType: ['qrCode'] })`, parse the result, fetch the order preview without changing state, and require a second explicit confirmation before posting `verify-pickup`. Disable the submit button while the request is pending.

- [ ] **Step 4: Run all Phase 1 verification**

Run:

```powershell
cd server
.\mvnw.cmd clean verify
cd ..\merchant-mini
npm test -- --run
npm run typecheck
cd ..\mini
npm test -- --run
npm run typecheck
```

Expected: all commands PASS.

- [ ] **Step 5: Commit**

```powershell
git add merchant-mini/miniprogram merchant-mini/tests
git commit -m "feat: add merchant pickup verification"
```

### Task 6: Phase 1 Operations Documentation and Real-Device Gate

**Files:**
- Modify: `README.md`
- Modify: `docs/operations/trial-acceptance.md`
- Create: `docs/operations/merchant-mini-local-testing.md`

**Interfaces:**
- Consumes: all Phase 1 runtime configuration and flows.
- Produces: exact local launch and WeChat DevTools acceptance instructions.

- [ ] **Step 1: Document exact environment and launch commands**

```powershell
$env:MERCHANT_WECHAT_LOCAL_MOCK_ENABLED = "true"
$env:MERCHANT_WECHAT_LOCAL_MOCK_OPENID = "local-dev-staff"
cd server
.\mvnw.cmd spring-boot:run
```

Document importing `merchant-mini/` into WeChat DevTools, setting the local API URL, and replacing `touristappid` only in local/private project configuration until the real AppID is registered.

- [ ] **Step 2: Add the acceptance checklist**

Checklist must include owner login, cashier login, disabled staff, accept, ready, pay-at-store, correct/incorrect pickup code, duplicate click, concurrent employee action, foreground reminder, and customer/admin regression.

- [ ] **Step 3: Run documentation and diff checks**

Run: `git diff --check; rg -n "MERCHANT_WECHAT|merchant-mini" README.md docs/operations`

Expected: no whitespace errors and all runtime keys documented.

- [ ] **Step 4: Perform real-device acceptance**

Use WeChat DevTools plus one real phone. Record pass/fail and device/base-library version in `docs/operations/trial-acceptance.md`; do not mark the gate complete based only on unit tests.

- [ ] **Step 5: Commit**

```powershell
git add README.md docs/operations
git commit -m "docs: add merchant mini program testing guide"
```
