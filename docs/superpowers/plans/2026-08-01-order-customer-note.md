# Order Customer Note Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow a customer to submit one immutable, optional, 100-character note for an order and display it in both customer and admin order details.

**Architecture:** Add a nullable `customer_note` column and carry it through the existing create-order command, `CustomerOrder` aggregate, and customer/admin views. Keep retry safety by storing the note inside the existing pending checkout request. Render the value only on detail pages and never add an update endpoint.

**Tech Stack:** Java 17, Spring Boot 3.5.9, Jakarta Validation, JPA, Flyway/MySQL 8.4, native WeChat Mini Program TypeScript/WXML/WXSS, Vue 3, Element Plus, Vitest, JUnit 5/Testcontainers.

## Global Constraints

- `customerNote` is optional, trimmed by the server, stored as `NULL` when blank, and limited to exactly 100 characters.
- The note applies to the whole order, is immutable after creation, and is rendered as plain text.
- Existing clients that omit `customerNote` must continue to create orders successfully.
- The existing idempotency key must replay the original persisted note without creating a second order.
- The note appears only when non-empty in mini-program and admin order details.
- Do not reuse `order_status_history.remark`; it remains a status-transition field.

---

### Task 1: Persist and expose the order note in the service API

**Files:**
- Create: `server/src/main/resources/db/migration/V3__add_customer_order_note.sql`
- Modify: `server/src/main/java/com/luneng/smartstore/order/CreateOrderRequest.java:11-18`
- Modify: `server/src/main/java/com/luneng/smartstore/order/CreateOrderCommand.java:5-13`
- Modify: `server/src/main/java/com/luneng/smartstore/order/CustomerOrder.java:38-92`
- Modify: `server/src/main/java/com/luneng/smartstore/order/OrderView.java:6-42`
- Modify: `server/src/main/java/com/luneng/smartstore/order/AdminOrderView.java:6-39`
- Modify: `server/src/main/java/com/luneng/smartstore/order/MiniOrderController.java:30-50`
- Modify: `server/src/main/java/com/luneng/smartstore/order/OrderApplicationService.java:56-117`
- Test: `server/src/test/java/com/luneng/smartstore/order/MiniOrderControllerTest.java`
- Test: `server/src/test/java/com/luneng/smartstore/order/OrderApplicationServiceTest.java`
- Test: `server/src/test/java/com/luneng/smartstore/order/AdminOrderWorkflowTest.java`
- Test: `server/src/test/java/com/luneng/smartstore/order/OrderConcurrencyTest.java`
- Test: `server/src/test/java/com/luneng/smartstore/e2e/OrderLifecycleE2ETest.java`

**Interfaces:**
- Consumes: existing `POST /api/mini/orders`, `Idempotency-Key`, `CreateOrderItem` and `OrderView` flow.
- Produces: `CreateOrderRequest.customerNote(): String`, `CreateOrderCommand.customerNote(): String`, `CustomerOrder.getCustomerNote(): String`, `OrderView.customerNote(): String`, and `AdminOrderView.customerNote(): String`.

- [ ] **Step 1: Add failing HTTP tests for absent, trimmed, and overlong notes**

Add tests that post these payloads and assert the response/database values:

```java
@Test
void createOrderStoresAndReturnsTrimmedCustomerNote() throws Exception {
    mockMvc.perform(post("/api/mini/orders")
            .header("Authorization", "Bearer " + customerToken)
            .header("Idempotency-Key", "note-001")
            .contentType(APPLICATION_JSON)
            .content("""
                {
                  "pickupName": "李先生",
                  "phone": "13800138000",
                  "customerNote": "  饮料要常温，易碎品请轻放  ",
                  "items": [{"productId": 10, "quantity": 1}]
                }
                """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.customerNote")
            .value("饮料要常温，易碎品请轻放"));

    assertThat(jdbcTemplate.queryForObject(
        "select customer_note from customer_order where idempotency_key = ?",
        String.class,
        "note-001"
    )).isEqualTo("饮料要常温，易碎品请轻放");
}

@Test
void createOrderRemainsCompatibleWhenCustomerNoteIsMissing() throws Exception {
    // Reuse the existing payload without customerNote.
    // Assert HTTP 200 and $.data.customerNote does not contain a value.
}

@Test
void createOrderRejectsCustomerNoteLongerThanOneHundredCharacters() throws Exception {
    String note = "备".repeat(101);
    mockMvc.perform(post("/api/mini/orders")
            .header("Authorization", "Bearer " + customerToken)
            .header("Idempotency-Key", "note-too-long")
            .contentType(APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(Map.of(
                "pickupName", "李先生",
                "phone", "13800138000",
                "customerNote", note,
                "items", List.of(Map.of("productId", 10, "quantity", 1))
            ))))
        .andExpect(status().isBadRequest());
}
```

- [ ] **Step 2: Run the focused service test and verify failure**

Run:

```powershell
cd server
.\mvnw.cmd -Dtest=MiniOrderControllerTest,OrderApplicationServiceTest test
```

Expected: FAIL because the migration, request field, aggregate field and response field do not exist.

- [ ] **Step 3: Add the Flyway migration and request/command fields**

Create the migration:

```sql
ALTER TABLE customer_order
    ADD COLUMN customer_note VARCHAR(100) NULL AFTER phone;
```

Change the records to these signatures:

```java
public record CreateOrderRequest(
    @NotBlank @Size(max = 40) String pickupName,
    @NotBlank @Pattern(regexp = "^1\\d{10}$") String phone,
    @Size(max = 100) String customerNote,
    @NotEmpty List<@Valid Item> items
) { }

public record CreateOrderCommand(
    long customerId,
    String idempotencyKey,
    String pickupName,
    String phone,
    String customerNote,
    List<CreateOrderItem> items
) { }
```

Pass `body.customerNote()` between `phone` and `items` in `MiniOrderController.create`.
Update every existing `new CreateOrderCommand(...)` test call in
`OrderApplicationServiceTest`, `AdminOrderWorkflowTest`, `OrderConcurrencyTest`,
and `OrderLifecycleE2ETest` by inserting `null` between `phone` and `items`; this
preserves the old no-note scenario and keeps the test suite compiling.

- [ ] **Step 4: Store a normalized value in `CustomerOrder`**

Add the field, constructor argument and getter:

```java
@Column(name = "customer_note", length = 100)
private String customerNote;

private static String normalizeCustomerNote(String value) {
    if (value == null || value.isBlank()) return null;
    String normalized = value.trim();
    if (normalized.length() > 100) {
        throw new BusinessException(
            "VALIDATION_ERROR",
            "订单备注不能超过100个字符",
            HttpStatus.BAD_REQUEST
        );
    }
    return normalized;
}

public String getCustomerNote() {
    return customerNote;
}
```

Assign `this.customerNote = normalizeCustomerNote(customerNote);` in the constructor. Do not create a setter.

- [ ] **Step 5: Carry the note through service validation and both response views**

Construct the aggregate with `command.customerNote()` and add a direct guard to `validate`:

```java
|| (command.customerNote() != null && command.customerNote().trim().length() > 100)
```

Add `String customerNote` after `phone` in `OrderView` and `AdminOrderView`, and map it with `order.getCustomerNote()` / `view.customerNote()`.

- [ ] **Step 6: Verify service tests pass**

Run:

```powershell
cd server
.\mvnw.cmd -Dtest=MiniOrderControllerTest,OrderApplicationServiceTest test
```

Expected: PASS, including the old payload without `customerNote`.

- [ ] **Step 7: Commit the service slice**

```powershell
git add -- server/src/main/resources/db/migration/V3__add_customer_order_note.sql server/src/main/java/com/luneng/smartstore/order server/src/test/java/com/luneng/smartstore/order server/src/test/java/com/luneng/smartstore/e2e/OrderLifecycleE2ETest.java
git commit -m "feat: persist customer order notes"
```

### Task 2: Capture the note in checkout and preserve it across retries

**Files:**
- Modify: `mini/miniprogram/types/order.ts:11-38`
- Modify: `mini/miniprogram/store/checkout.ts:20-155`
- Modify: `mini/miniprogram/pages/checkout/index.ts:11-102`
- Modify: `mini/miniprogram/pages/checkout/index.wxml:38-67`
- Modify: `mini/miniprogram/pages/checkout/index.wxss`
- Test: `mini/tests/checkout.spec.ts`
- Test: `mini/tests/order-note-ui.spec.ts`

**Interfaces:**
- Consumes: `CreateOrderRequest.customerNote?: string`, existing pending checkout storage and `checkout.submit()`.
- Produces: `Checkout.updateCustomerNote(note: string): void`; checkout UI `customerNote` and `customerNoteCount` data.

- [ ] **Step 1: Add failing state and UI contract tests**

Extend the checkout test with:

```ts
checkout.updateCustomerNote('  饮料要常温  ')
await checkout.submit()

expect(orders.create).toHaveBeenCalledWith(
  expect.any(String),
  expect.objectContaining({ customerNote: '饮料要常温' }),
)
```

In the uncertain retry test, update the note before retry and assert both calls still use the original request note. Create `mini/tests/order-note-ui.spec.ts`:

```ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('order note UI', () => {
  it('renders an optional 100-character checkout note card', () => {
    const markup = readFileSync(
      resolve(__dirname, '../miniprogram/pages/checkout/index.wxml'),
      'utf8',
    )
    expect(markup).toContain('订单备注')
    expect(markup).toContain('maxlength="100"')
    expect(markup).toContain('{{customerNoteCount}} / 100')
    expect(markup).toContain('bindinput="onCustomerNoteInput"')
  })
})
```

- [ ] **Step 2: Run focused mini-program tests and verify failure**

Run:

```powershell
cd mini
npm test -- checkout.spec.ts order-note-ui.spec.ts
```

Expected: FAIL because the update method, request field and markup are absent.

- [ ] **Step 3: Extend checkout types and durable pending state**

Add the optional field:

```ts
export interface CreateOrderRequest {
  pickupName: string
  phone: string
  customerNote?: string
  items: CreateOrderItem[]
}
```

Extend the interface and state:

```ts
export interface Checkout {
  updateContact(profile: CustomerProfile): void
  updateCustomerNote(note: string): void
  submit(): Promise<CustomerOrder>
  isSubmitting(): boolean
}

let customerNote = ''

updateCustomerNote: (note) => {
  customerNote = note.slice(0, 100)
},
```

When building a new request, normalize it exactly once:

```ts
const normalizedNote = customerNote.trim()
request: {
  ...validContact,
  ...(normalizedNote ? { customerNote: normalizedNote } : {}),
  items: toRequestItems(selected),
},
```

Extend `isPendingCheckout` to accept an absent note or a string no longer than 100 characters. Never replace the note in an existing pending request during an uncertain retry.

- [ ] **Step 4: Add checkout page input handling and card markup**

Add page data and handler:

```ts
customerNote: '',
customerNoteCount: 0,

onCustomerNoteInput(event: WechatMiniprogram.Input) {
  const customerNote = event.detail.value.slice(0, 100)
  this.setData({ customerNote, customerNoteCount: customerNote.length })
  checkout.updateCustomerNote(customerNote)
},
```

Insert the card after the product list and before pickup/payment:

```xml
<view class="card checkout-section order-note-card">
  <view class="section-title">订单备注 <text class="muted">（选填）</text></view>
  <textarea
    class="order-note-input"
    value="{{customerNote}}"
    maxlength="100"
    placeholder="如：饮料要常温、易碎品请轻放"
    bindinput="onCustomerNoteInput"
  />
  <text class="order-note-count">{{customerNoteCount}} / 100</text>
</view>
```

Style the textarea with the existing card border, radius, muted placeholder and right-aligned helper text; do not introduce a new color token.

- [ ] **Step 5: Verify checkout state, UI contract and type safety**

Run:

```powershell
cd mini
npm test -- checkout.spec.ts order-note-ui.spec.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit the checkout slice**

```powershell
git add -- mini/miniprogram/types/order.ts mini/miniprogram/store/checkout.ts mini/miniprogram/pages/checkout mini/tests/checkout.spec.ts mini/tests/order-note-ui.spec.ts
git commit -m "feat: collect order notes at checkout"
```

### Task 3: Display the note in customer and admin order details

**Files:**
- Modify: `mini/miniprogram/types/order.ts:27-38`
- Modify: `mini/miniprogram/pages/order-detail/index.wxml:38-65`
- Modify: `mini/miniprogram/pages/order-detail/index.wxss`
- Modify: `admin/src/api/orders.ts:10-42`
- Modify: `admin/src/views/orders/OrderDetailView.vue:270-320`
- Test: `mini/tests/order-note-ui.spec.ts`
- Test: `admin/tests/OrderWorkflow.spec.ts`

**Interfaces:**
- Consumes: `CustomerOrder.customerNote?: string | null` and `AdminOrderDetail.customerNote: string | null` from Task 1.
- Produces: conditional plain-text “顾客备注” cards on both detail views.

- [ ] **Step 1: Add failing detail rendering tests**

Extend `order-note-ui.spec.ts`:

```ts
it('renders the note only in order detail', () => {
  const markup = readFileSync(
    resolve(__dirname, '../miniprogram/pages/order-detail/index.wxml'),
    'utf8',
  )
  expect(markup).toContain('wx:if="{{order.customerNote}}"')
  expect(markup).toContain('{{order.customerNote}}')
})
```

Add an admin component test that resolves an order with `customerNote: '饮料要常温'`, mounts `OrderDetailView`, and asserts the label and text are visible.

- [ ] **Step 2: Run focused UI tests and verify failure**

Run:

```powershell
cd mini
npm test -- order-note-ui.spec.ts
cd ..\admin
npm test -- OrderWorkflow.spec.ts
```

Expected: FAIL because both detail views omit the field.

- [ ] **Step 3: Extend client response types**

Add the response properties:

```ts
// mini CustomerOrder
customerNote?: string | null

// admin AdminOrderSummary or AdminOrderDetail
customerNote: string | null
```

Keep it off list cards even if the server returns it; only the detail component renders it.

- [ ] **Step 4: Render conditional plain-text sections**

Mini-program markup:

```xml
<view wx:if="{{order.customerNote}}" class="card customer-note-card">
  <view class="section-title">顾客备注</view>
  <text class="customer-note-text">{{order.customerNote}}</text>
</view>
```

Admin markup:

```vue
<section v-if="order.customerNote" class="surface-card customer-note-card">
  <h2>顾客备注</h2>
  <p class="customer-note-text">{{ order.customerNote }}</p>
</section>
```

Use `white-space: pre-wrap; overflow-wrap: anywhere;` in both clients. Do not use `rich-text` or `v-html`.

- [ ] **Step 5: Run focused and full regression suites**

Run:

```powershell
cd server
.\mvnw.cmd test
cd ..\mini
npm test
npm run typecheck
cd ..\admin
npm test
npm run build
```

Expected: all tests, type checks and production build pass.

- [ ] **Step 6: Commit the detail and regression slice**

```powershell
git add -- mini/miniprogram/types/order.ts mini/miniprogram/pages/order-detail mini/tests/order-note-ui.spec.ts admin/src/api/orders.ts admin/src/views/orders/OrderDetailView.vue admin/tests/OrderWorkflow.spec.ts
git commit -m "feat: show customer notes in order details"
```
