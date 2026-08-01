# WeChat Online Payment and Refund Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add secure WeChat mini-program online payment, 15-minute inventory reservation, automatic close, full refund, compensation, and consistent customer/merchant/admin projections.

**Architecture:** Keep business orders, WeChat payment attempts, and refund attempts as separate records. The server is the source of truth: it calculates amount, invokes the official APIv3 SDK, verifies/decrypts callbacks, actively queries uncertain outcomes, and exposes only trusted projections to clients. Cancellation writes a refund intent transactionally; a retryable processor performs the external refund.

**Tech Stack:** Java 17, Spring Boot 3.5.9, MySQL/Flyway, Redis, `com.github.wechatpay-apiv3:wechatpay-java:0.2.17`, native WeChat Mini Program `wx.requestPayment`, Vitest, Testcontainers.

## Global Constraints

- Payment choice is `WECHAT_MINI` or `PAY_AT_STORE`; default customer choice is `WECHAT_MINI`.
- Online payment expires exactly 15 minutes after business-order creation.
- Amount is integer cents and is calculated only from server-side product snapshots.
- `wx.requestPayment` callback never marks an order paid; server callback or active query does.
- Pending online orders are hidden from merchant work queues and reminders.
- Customer cancellation is allowed only before merchant acceptance; paid cancellation creates one full refund.
- Refund API acceptance means `PROCESSING`, not success.
- First release has no partial refund.

---

### Task 1: Payment and Refund Persistence Model

**Files:**
- Create: `server/src/main/resources/db/migration/V8__create_online_payment_and_refund.sql`
- Create: `server/src/main/java/com/luneng/smartstore/payment/PaymentOption.java`
- Create: `server/src/main/java/com/luneng/smartstore/payment/OnlinePaymentStatus.java`
- Create: `server/src/main/java/com/luneng/smartstore/payment/RefundStatus.java`
- Create: `server/src/main/java/com/luneng/smartstore/payment/OnlinePayment.java`
- Create: `server/src/main/java/com/luneng/smartstore/payment/OnlinePaymentRepository.java`
- Create: `server/src/main/java/com/luneng/smartstore/payment/RefundOrder.java`
- Create: `server/src/main/java/com/luneng/smartstore/payment/RefundOrderRepository.java`
- Modify: `server/src/main/java/com/luneng/smartstore/order/PaymentMethod.java`
- Modify: `server/src/main/java/com/luneng/smartstore/order/CustomerOrder.java`
- Modify: `server/src/main/java/com/luneng/smartstore/order/OrderView.java`
- Modify: `server/src/main/java/com/luneng/smartstore/order/AdminOrderView.java`
- Test: `server/src/test/java/com/luneng/smartstore/payment/PaymentPersistenceTest.java`
- Test: `server/src/test/java/com/luneng/smartstore/common/DatabaseMigrationTest.java`

**Interfaces:**
- Produces: `PaymentOption { WECHAT_MINI, PAY_AT_STORE }`.
- Extends: `PaymentMethod` with `WECHAT_MINI` while preserving `CASH` and `WECHAT_QR`.
- Produces: `OnlinePaymentStatus { NOTPAY, SUCCESS, CLOSED, EXCEPTION }` and `RefundStatus { CREATED, PROCESSING, SUCCESS, CLOSED, ABNORMAL }`.

- [ ] **Step 1: Write migration and failing persistence tests**

```sql
alter table customer_order
  add column payment_option varchar(32) not null default 'PAY_AT_STORE',
  add column payment_deadline timestamp null;

create table online_payment (
  id bigint primary key auto_increment,
  order_id bigint not null,
  out_trade_no varchar(64) not null,
  transaction_id varchar(64) null,
  app_id varchar(64) not null,
  mch_id varchar(32) not null,
  amount_cent bigint not null,
  currency varchar(8) not null default 'CNY',
  status varchar(32) not null,
  expires_at timestamp not null,
  paid_at timestamp null,
  closed_at timestamp null,
  last_notification_id varchar(64) null,
  last_queried_at timestamp null,
  version bigint not null default 0,
  created_at timestamp not null default current_timestamp,
  updated_at timestamp not null default current_timestamp on update current_timestamp,
  constraint fk_online_payment_order foreign key (order_id) references customer_order(id),
  constraint uk_online_payment_order unique (order_id),
  constraint uk_online_payment_out_trade_no unique (out_trade_no),
  constraint uk_online_payment_transaction_id unique (transaction_id)
);
```

Create `refund_order` with unique `order_id`, unique `out_refund_no`, original/refund cents, status, reason, WeChat refund ID, notification ID, timestamps, error detail, and version.

- [ ] **Step 2: Run persistence tests and verify failure**

Run: `cd server; .\mvnw.cmd -Dtest=PaymentPersistenceTest,DatabaseMigrationTest test`

Expected: FAIL before V8 and entities exist.

- [ ] **Step 3: Implement entities and projections**

```java
public enum PaymentOption { WECHAT_MINI, PAY_AT_STORE }
public enum OnlinePaymentStatus { NOTPAY, SUCCESS, CLOSED, EXCEPTION }
public enum RefundStatus { CREATED, PROCESSING, SUCCESS, CLOSED, ABNORMAL }
```

Expose `paymentOption`, `paymentDeadline`, `onlinePaymentStatus`, and `refundStatus` in order views without exposing merchant IDs, transaction IDs, callback payloads, or secrets to mini programs.

- [ ] **Step 4: Run persistence and order regression tests**

Run: `cd server; .\mvnw.cmd -Dtest=PaymentPersistenceTest,DatabaseMigrationTest,OrderApplicationServiceTest,AdminOrderWorkflowTest test`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add server/src/main/resources/db/migration/V8__create_online_payment_and_refund.sql server/src/main/java/com/luneng/smartstore/payment server/src/main/java/com/luneng/smartstore/order server/src/test/java/com/luneng/smartstore/payment server/src/test/java/com/luneng/smartstore/common/DatabaseMigrationTest.java
git commit -m "feat: add online payment persistence"
```

### Task 2: WeChat Pay APIv3 Gateway

**Files:**
- Modify: `server/pom.xml`
- Modify: `server/src/main/resources/application.yml`
- Create: `server/src/main/java/com/luneng/smartstore/payment/WechatPayProperties.java`
- Create: `server/src/main/java/com/luneng/smartstore/payment/WechatPayGateway.java`
- Create: `server/src/main/java/com/luneng/smartstore/payment/WechatPayApiV3Gateway.java`
- Create: `server/src/main/java/com/luneng/smartstore/payment/WechatPayConfiguration.java`
- Test: `server/src/test/java/com/luneng/smartstore/payment/WechatPayGatewayContractTest.java`
- Test: `server/src/test/java/com/luneng/smartstore/payment/WechatPayPropertiesTest.java`

**Interfaces:**
- Produces: `prepay(PrepayCommand)`, `query(String outTradeNo)`, `close(String outTradeNo)`, `refund(RefundCommand)`, `queryRefund(String outRefundNo)`, `parsePaymentNotification(headers, body)`, and `parseRefundNotification(headers, body)`.

- [ ] **Step 1: Write gateway contract tests with an in-memory fake**

```java
public interface WechatPayGateway {
    RequestPaymentParameters prepay(PrepayCommand command);
    PaymentQueryResult query(String outTradeNo);
    void close(String outTradeNo);
    RefundSubmitResult refund(RefundCommand command);
    RefundQueryResult queryRefund(String outRefundNo);
    PaymentNotification parsePaymentNotification(HttpHeaders headers, String body);
    RefundNotification parseRefundNotification(HttpHeaders headers, String body);
}
```

Tests assert exact cents, AppID, merchant ID, OpenID, `time_expire`, notify URLs, and stable merchant order numbers.

- [ ] **Step 2: Add official SDK and verify tests fail on missing adapter**

```xml
<dependency>
  <groupId>com.github.wechatpay-apiv3</groupId>
  <artifactId>wechatpay-java</artifactId>
  <version>0.2.17</version>
</dependency>
```

Run: `cd server; .\mvnw.cmd -Dtest=WechatPayGatewayContractTest,WechatPayPropertiesTest test`

Expected: FAIL with missing adapter/configuration.

- [ ] **Step 3: Implement the production adapter**

Use `JsapiServiceExtension.prepayWithRequestPayment` for mini-program payment and the SDK notification parser for signature verification and APIv3 decryption. Bind exact production keys:

```yaml
smart-store:
  wechat-pay:
    enabled: ${WECHAT_PAY_ENABLED:false}
    app-id: ${WECHAT_PAY_APP_ID:}
    merchant-id: ${WECHAT_PAY_MERCHANT_ID:}
    merchant-serial-number: ${WECHAT_PAY_MERCHANT_SERIAL_NUMBER:}
    private-key-path: ${WECHAT_PAY_PRIVATE_KEY_PATH:}
    api-v3-key: ${WECHAT_PAY_API_V3_KEY:}
    public-key-path: ${WECHAT_PAY_PUBLIC_KEY_PATH:}
    public-key-id: ${WECHAT_PAY_PUBLIC_KEY_ID:}
    payment-notify-url: ${WECHAT_PAY_NOTIFY_URL:}
    refund-notify-url: ${WECHAT_REFUND_NOTIFY_URL:}
```

When `enabled=false`, inject a local fake only under the `local`/test configuration; production startup with enabled payment and missing keys must fail fast.

- [ ] **Step 4: Run gateway tests**

Run: `cd server; .\mvnw.cmd -Dtest=WechatPayGatewayContractTest,WechatPayPropertiesTest test`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add server/pom.xml server/src/main/resources/application.yml server/src/main/java/com/luneng/smartstore/payment server/src/test/java/com/luneng/smartstore/payment
git commit -m "feat: add wechat pay api v3 gateway"
```

### Task 3: Payment Application, Callback, Expiry, and Refund Processor

**Files:**
- Modify: `server/src/main/java/com/luneng/smartstore/order/CreateOrderRequest.java`
- Modify: `server/src/main/java/com/luneng/smartstore/order/CreateOrderCommand.java`
- Modify: `server/src/main/java/com/luneng/smartstore/order/OrderApplicationService.java`
- Modify: `server/src/main/java/com/luneng/smartstore/order/OrderRepository.java`
- Modify: `server/src/main/java/com/luneng/smartstore/order/MiniOrderController.java`
- Modify: `server/src/main/java/com/luneng/smartstore/order/AdminOrderService.java`
- Modify: `server/src/main/java/com/luneng/smartstore/merchant/MerchantOrderService.java`
- Create: `server/src/main/java/com/luneng/smartstore/payment/PaymentApplicationService.java`
- Create: `server/src/main/java/com/luneng/smartstore/payment/PaymentController.java`
- Create: `server/src/main/java/com/luneng/smartstore/payment/WechatPayNotificationController.java`
- Create: `server/src/main/java/com/luneng/smartstore/payment/PaymentCompensationJob.java`
- Create: `server/src/main/java/com/luneng/smartstore/payment/RefundProcessor.java`
- Test: `server/src/test/java/com/luneng/smartstore/payment/PaymentApplicationServiceTest.java`
- Test: `server/src/test/java/com/luneng/smartstore/payment/PaymentNotificationApiTest.java`
- Test: `server/src/test/java/com/luneng/smartstore/payment/PaymentRaceTest.java`
- Test: `server/src/test/java/com/luneng/smartstore/payment/RefundProcessorTest.java`

**Interfaces:**
- Produces: `POST /api/mini/orders/{orderNo}/payments/prepay`, `GET /api/mini/orders/{orderNo}/payment-status`, `GET /api/mini/orders/{orderNo}/refund-status`.
- Produces public callback paths `/api/payment/wechat/notifications/payment` and `/api/payment/wechat/notifications/refund`.

- [ ] **Step 1: Write failing lifecycle and race tests**

```java
PaymentPreparation prepared = service.prepare(customerId, orderNo);
assertThat(prepared.expiresAt()).isEqualTo(order.getCreatedAt().plus(Duration.ofMinutes(15)));
assertThat(gateway.lastCommand().amountCent()).isEqualTo(order.getTotalCent());
```

Cover successful callback, duplicate callback, amount mismatch, AppID mismatch, customer cancel before acceptance, owner cancel, refund duplicate, refund abnormal, payment callback versus expiry, and payment success discovered after local close.

- [ ] **Step 2: Run tests and verify failure**

Run: `cd server; .\mvnw.cmd -Dtest=PaymentApplicationServiceTest,PaymentNotificationApiTest,PaymentRaceTest,RefundProcessorTest test`

Expected: FAIL with missing services/endpoints.

- [ ] **Step 3: Implement transactional lifecycle**

```java
@Transactional
public void applyPaymentSuccess(PaymentNotification notice) {
    OnlinePayment payment = payments.findLockedByOutTradeNo(notice.outTradeNo()).orElseThrow();
    payment.verifyIdentityAndAmount(notice.appId(), notice.merchantId(), notice.amountCent());
    if (payment.isSuccess()) return;
    if (payment.order().isCancelled()) {
        payment.markSuccess(notice.transactionId(), notice.paidAt(), notice.notificationId());
        refunds.createFullRefundIfAbsent(payment.order(), "支付结果晚于本地关单");
        return;
    }
    payment.markSuccess(notice.transactionId(), notice.paidAt(), notice.notificationId());
    payment.order().markPaid(PaymentMethod.WECHAT_MINI);
}
```

The expiry job must lock the payment row, query WeChat before closing, call close only for `NOTPAY`, then cancel/release inventory once. Cancellation creates `RefundOrder(CREATED)` in the same local transaction; `RefundProcessor` submits it after commit and changes to `PROCESSING`, then callback/query determines final status.

- [ ] **Step 4: Run payment plus full order suites**

Run: `cd server; .\mvnw.cmd -Dtest=PaymentApplicationServiceTest,PaymentNotificationApiTest,PaymentRaceTest,RefundProcessorTest,OrderApplicationServiceTest,AdminOrderWorkflowTest,MerchantOrderApiTest,OrderConcurrencyTest test`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add server/src/main/java/com/luneng/smartstore/order server/src/main/java/com/luneng/smartstore/payment server/src/main/java/com/luneng/smartstore/merchant server/src/test/java/com/luneng/smartstore/payment
git commit -m "feat: implement payment and refund lifecycle"
```

### Task 4: Customer Mini Program Payment UX

**Files:**
- Modify: `mini/miniprogram/types/order.ts`
- Modify: `mini/miniprogram/services/orders.ts`
- Create: `mini/miniprogram/services/payments.ts`
- Modify: `mini/miniprogram/pages/checkout/index.ts`
- Modify: `mini/miniprogram/pages/checkout/index.wxml`
- Modify: `mini/miniprogram/pages/checkout/index.wxss`
- Modify: `mini/miniprogram/pages/submit-result/*`
- Modify: `mini/miniprogram/pages/orders/*`
- Modify: `mini/miniprogram/pages/order-detail/*`
- Test: `mini/tests/payment-choice.spec.ts`
- Test: `mini/tests/payment-flow.spec.ts`
- Test: `mini/tests/payment-status-presentation.spec.ts`

**Interfaces:**
- Consumes: Task 3 customer payment endpoints.
- Produces: `requestWechatPayment(parameters)` wrapper and `paymentPresentation(order)` for pending, paid, refund-processing, refunded, and abnormal states.

- [ ] **Step 1: Write failing UX tests**

```ts
expect(defaultPaymentOption()).toBe('WECHAT_MINI')
expect(paymentPresentation(pendingOrder).primaryAction).toBe('立即支付')
expect(paymentPresentation(expiredOrder).statusText).toBe('支付超时，订单已关闭')
```

Cover 15-minute countdown, canceling the WeChat cashier, retry within deadline, client-success/server-query-pending, server-confirmed success, and refund states.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `cd mini; npm test -- --run tests/payment-choice.spec.ts tests/payment-flow.spec.ts tests/payment-status-presentation.spec.ts`

Expected: FAIL.

- [ ] **Step 3: Implement payment selection and requestPayment wrapper**

```ts
export const requestWechatPayment = (
  params: WechatMiniprogram.RequestPaymentOption,
): Promise<void> => new Promise((resolve, reject) => {
  wx.requestPayment({ ...params, success: () => resolve(), fail: reject })
})
```

After either success or failure callback, query the server. Do not show “支付成功” until the server reports `PAID`. Keep “立即支付” available until the server-provided deadline.

- [ ] **Step 4: Run customer mini suite and typecheck**

Run: `cd mini; npm test -- --run; npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add mini/miniprogram mini/tests
git commit -m "feat: add customer wechat payment flow"
```

### Task 5: Merchant and Admin Payment/Refund Projections

**Files:**
- Modify: `merchant-mini/miniprogram/types/order.ts`
- Modify: `merchant-mini/miniprogram/pages/orders/*`
- Modify: `merchant-mini/miniprogram/pages/order-detail/*`
- Modify: `merchant-mini/miniprogram/pages/verify-pickup/*`
- Modify: `admin/src/api/orders.ts`
- Modify: `admin/src/views/orders/OrderListView.vue`
- Modify: `admin/src/views/orders/OrderDetailView.vue`
- Test: `merchant-mini/tests/payment-projection.spec.ts`
- Test: `admin/tests/OrderWorkflow.spec.ts`

**Interfaces:**
- Consumes: trusted order view fields from Tasks 1–3.
- Produces: labels `微信已付款`, `到店付款`, `退款处理中`, `已退款`, `退款异常`.

- [ ] **Step 1: Write failing role and presentation tests**

```ts
expect(merchantPaymentLabel({ paymentOption: 'WECHAT_MINI', paymentStatus: 'PAID' }))
  .toBe('微信已付款')
expect(canShowCollectPayment(onlinePaidOrder)).toBe(false)
```

Admin tests assert pending-payment orders are excluded from default operational counts, can be found with the explicit payment-state filter, and refund abnormal displays a re-query action.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `cd merchant-mini; npm test -- --run tests/payment-projection.spec.ts; cd ..\admin; npm test -- --run tests/OrderWorkflow.spec.ts`

Expected: FAIL.

- [ ] **Step 3: Implement trusted projections**

Merchant cancellation copy must be `取消后将自动原路退款` and success copy `订单已取消，退款处理中`. Never expose a refund-success label until server status is `SUCCESS`.

- [ ] **Step 4: Run merchant/admin suites**

Run: `cd merchant-mini; npm test -- --run; npm run typecheck; cd ..\admin; npm test -- --run; npm run build`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add merchant-mini admin
git commit -m "feat: show payment and refund status across staff clients"
```

### Task 6: Payment Operations, Reconciliation, and Real-Money Gate

**Files:**
- Modify: `deploy/env.example`
- Modify: `deploy/compose.production.yaml`
- Modify: `docs/operations/deployment.md`
- Create: `docs/operations/wechat-pay-runbook.md`
- Modify: `docs/operations/backup-and-restore.md`
- Modify: `docs/operations/trial-acceptance.md`
- Test: `deploy/tests/production-readiness.test.mjs`

**Interfaces:**
- Produces: production readiness checks for all WeChat payment keys and callback URLs.

- [ ] **Step 1: Add failing readiness checks**

Require non-empty merchant ID, serial, readable private/public key paths, 32-byte APIv3 key, HTTPS payment/refund notify URLs, and exact customer AppID when `WECHAT_PAY_ENABLED=true`.

- [ ] **Step 2: Run readiness tests and verify failure**

Run: `node --test deploy/tests/production-readiness.test.mjs`

Expected: FAIL until the new keys are validated.

- [ ] **Step 3: Implement configuration and runbook**

Document merchant onboarding, AppID binding, key rotation, callback firewall rules, payment/refund query, close-order recovery, refund abnormal handling, daily reconciliation, and secret backup. Reference the official docs already linked in the approved payment spec.

- [ ] **Step 4: Run full Phase 2 verification and real low-value transaction**

Run all server, mini, merchant-mini, admin, and deployment tests. Then use a real customer account to pay the smallest practical product order, cancel it before acceptance, verify refund arrival, and match business order number, `out_trade_no`, `transaction_id`, `out_refund_no`, inventory ledger, and WeChat merchant-platform records.

- [ ] **Step 5: Commit**

```powershell
git add deploy docs/operations
git commit -m "docs: add wechat payment operations runbook"
```
