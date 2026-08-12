# Customer Support Chat MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an authenticated text-only customer-to-store support channel with optional order context, unread counts, and recoverable polling in both WeChat mini programs.

**Architecture:** A new `support` bounded package owns conversations and messages in MySQL. Each customer has one store conversation; messages may reference one of that customer's orders. Customer and merchant REST controllers expose client-specific views while sharing a transactional service. Both mini programs use page-scoped 10-second polling that stops in the background, with idempotent client message IDs for safe retries.

**Tech Stack:** Java 17, Spring Boot 3, Spring Data JPA, Flyway, MySQL 8, Vitest, TypeScript, native WeChat Mini Program WXML/WXSS.

## Global Constraints

- Reuse existing customer JWT and merchant-mini OWNER/CASHIER authorization; never expose `openid` or raw session data.
- Text only in this phase: 1-500 trimmed Unicode characters; no image, voice, file, emoji-only structural icons, WebSocket, deletion, or automated replies.
- A customer can read and send only in their own conversation and may reference only their own order.
- Every send requires a stable `clientMessageId`; retries with the same actor and ID return the original message without increasing unread counts.
- Poll every 10 seconds only while the page is visible and a valid session exists; concurrent polls are deduplicated and stopped on hide/unload.
- Use existing navy theme tokens, local SVG icons, 44px minimum touch targets, safe-area padding, and readable empty/error/loading states.

---

### Task 1: Persist conversations and messages

**Files:**
- Create: `server/src/main/resources/db/migration/V9__create_customer_support_chat.sql`
- Create: `server/src/main/java/com/luneng/smartstore/support/SupportConversation.java`
- Create: `server/src/main/java/com/luneng/smartstore/support/SupportMessage.java`
- Create: `server/src/main/java/com/luneng/smartstore/support/SupportSenderType.java`
- Create: `server/src/main/java/com/luneng/smartstore/support/SupportConversationRepository.java`
- Create: `server/src/main/java/com/luneng/smartstore/support/SupportMessageRepository.java`
- Test: `server/src/test/java/com/luneng/smartstore/support/SupportChatMigrationTest.java`

**Interfaces:**
- Produces: one conversation per `customer_user`, optional `last_related_order_id`, mutable customer/merchant unread counters, and ordered messages with unique `(sender_type, sender_id, client_message_id)`.
- Produces repository operations for customer lookup, merchant paging ordered by `last_message_at DESC`, pessimistic conversation locking, message paging after an ID, and unread conversation counting.

- [ ] **Step 1: Write the failing migration test**

Create a Testcontainers migration test that migrates through V8, inserts one customer and order, migrates V9, then asserts both tables, foreign keys, unique client-message constraint, content length check, and zero unread defaults.

- [ ] **Step 2: Run the migration test to verify RED**

Run: `server\mvnw.cmd -f server\pom.xml -Dtest=SupportChatMigrationTest test`

Expected: FAIL because V9 and the support tables do not exist.

- [ ] **Step 3: Add V9 and minimal JPA entities/repositories**

Create `customer_support_conversation` with `customer_id UNIQUE`, nullable `last_related_order_id`, preview/timestamp, unread counts, version, and timestamps. Create `customer_support_message` with conversation, sender type/id, optional order, 500-character content, stable client ID, and created timestamp. Add indexes for merchant recency and message cursor reads.

- [ ] **Step 4: Run focused migration and repository tests to verify GREEN**

Run: `server\mvnw.cmd -f server\pom.xml -Dtest=SupportChatMigrationTest test`

Expected: PASS with zero failures and errors.

- [ ] **Step 5: Commit the persistence slice**

```powershell
git add server/src/main/resources/db/migration/V9__create_customer_support_chat.sql server/src/main/java/com/luneng/smartstore/support server/src/test/java/com/luneng/smartstore/support/SupportChatMigrationTest.java
git commit -m "feat: persist customer support chats"
```

### Task 2: Implement secure customer and merchant support APIs

**Files:**
- Create: `server/src/main/java/com/luneng/smartstore/support/SupportChatService.java`
- Create: `server/src/main/java/com/luneng/smartstore/support/CustomerSupportController.java`
- Create: `server/src/main/java/com/luneng/smartstore/support/MerchantSupportController.java`
- Create: `server/src/main/java/com/luneng/smartstore/support/SupportConversationView.java`
- Create: `server/src/main/java/com/luneng/smartstore/support/SupportMessageView.java`
- Modify: `server/src/main/java/com/luneng/smartstore/auth/SecurityConfig.java`
- Modify: `server/src/main/java/com/luneng/smartstore/merchant/MerchantDashboardService.java`
- Test: `server/src/test/java/com/luneng/smartstore/support/SupportChatApiTest.java`
- Modify test: `server/src/test/java/com/luneng/smartstore/merchant/MerchantDashboardApiTest.java`

**Interfaces:**
- Customer: `POST /api/mini/support/conversations`, `GET/POST /api/mini/support/conversations/{id}/messages`, and `POST /api/mini/support/conversations/{id}/read`.
- Merchant: `GET /api/merchant-mini/support/conversations`, `GET/POST /api/merchant-mini/support/conversations/{id}/messages`, and `POST /api/merchant-mini/support/conversations/{id}/read`.
- `SupportConversationView`: `id`, customer display name, masked phone, optional related order number, preview, last-message time, unread count.
- `SupportMessageView`: `id`, sender side (`CUSTOMER` or `MERCHANT`), content, optional related order number, created time.

- [ ] **Step 1: Write failing API contract tests**

Cover customer open/send/read, customer isolation, foreign-order rejection, blank/501-character rejection, stable client-message idempotency, OWNER and CASHIER list/reply, unauthenticated/client-type rejection, cursor ordering, unread reset, and dashboard `waitingConversationCount`.

- [ ] **Step 2: Run the support API suite to verify RED**

Run: `server\mvnw.cmd -f server\pom.xml -Dtest=SupportChatApiTest,MerchantDashboardApiTest test`

Expected: FAIL with missing support controllers/service and dashboard count remaining zero.

- [ ] **Step 3: Implement the transactional service and controllers**

Lock a conversation during send/read; normalize content with `trim`; validate referenced order ownership for customer calls; return the prior message on duplicate client ID; increment only the opposite side's unread count; store a privacy-safe preview; mask phones before merchant serialization; update `last_related_order_id` only when an order is supplied.

- [ ] **Step 4: Add customer route authorization and dashboard unread query**

Add `/api/mini/support/**` to the authenticated customer matcher. Inject the support repository/service into `MerchantDashboardService` and count conversations where merchant unread count is greater than zero.

- [ ] **Step 5: Run focused service/API regression to verify GREEN**

Run: `server\mvnw.cmd -f server\pom.xml -Dtest=SupportChatApiTest,MerchantDashboardApiTest,ClientTypeSecurityTest test`

Expected: PASS with zero failures and errors.

- [ ] **Step 6: Commit the API slice**

```powershell
git add server/src/main/java/com/luneng/smartstore/support server/src/main/java/com/luneng/smartstore/auth/SecurityConfig.java server/src/main/java/com/luneng/smartstore/merchant/MerchantDashboardService.java server/src/test/java/com/luneng/smartstore/support server/src/test/java/com/luneng/smartstore/merchant/MerchantDashboardApiTest.java
git commit -m "feat: add customer support chat APIs"
```

### Task 3: Build the customer chat entry and page

**Files:**
- Create: `mini/miniprogram/types/support.ts`
- Create: `mini/miniprogram/services/support.ts`
- Create: `mini/miniprogram/utils/support-polling.ts`
- Create: `mini/miniprogram/pages/support-chat/index.ts`
- Create: `mini/miniprogram/pages/support-chat/index.wxml`
- Create: `mini/miniprogram/pages/support-chat/index.wxss`
- Create: `mini/miniprogram/pages/support-chat/index.json`
- Modify: `mini/miniprogram/app.json`
- Modify: `mini/miniprogram/pages/profile/index.ts`
- Modify: `mini/miniprogram/pages/profile/index.wxml`
- Modify: `mini/miniprogram/pages/order-detail/index.ts`
- Modify: `mini/miniprogram/pages/order-detail/index.wxml`
- Test: `mini/tests/support-chat.spec.ts`

**Interfaces:**
- `supportService.open(orderNo?)`, `messages(conversationId, afterId)`, `send(conversationId, content, orderNo, clientMessageId)`, and `markRead(conversationId, lastMessageId)`.
- Profile entry opens chat without order context; order detail entry opens `/pages/support-chat/index?orderNo=<encoded>`.

- [ ] **Step 1: Write failing customer contracts and polling tests**

Assert exact API paths/payloads, stable message ID across a failed retry, no request for blank input, login gating, order-number URL encoding, one 10-second foreground poll, stop on hide/unload, one in-flight request, chronological message rendering, safe-area composer, 44px send target, and recoverable error state.

- [ ] **Step 2: Run customer focused tests to verify RED**

Run: `npm test -- --run tests/support-chat.spec.ts` from `mini`.

Expected: FAIL because the service, polling utility, page, and entries do not exist.

- [ ] **Step 3: Implement service, polling utility, and registered page**

Open the single customer conversation on load, fetch the latest 50 messages, append only IDs not already present, mark the newest merchant message read, preserve unsent text after failures, and reuse the same generated client ID until that text sends successfully or changes.

- [ ] **Step 4: Implement the customer UI and entry points**

Use the existing navy custom header, a flat light message surface, left-aligned merchant bubbles, right-aligned customer bubbles, an optional order-context chip, explicit loading/empty/error states, and a fixed composer above the safe area. Require login before navigation.

- [ ] **Step 5: Run customer full verification**

Run: `npm test -- --run && npm run typecheck` from `mini`.

Expected: all customer tests and typecheck pass.

- [ ] **Step 6: Commit the customer slice**

```powershell
git add mini/miniprogram mini/tests/support-chat.spec.ts
git commit -m "feat: add customer support chat"
```

### Task 4: Replace the merchant placeholder with conversation management

**Files:**
- Create: `merchant-mini/miniprogram/types/support.ts`
- Create: `merchant-mini/miniprogram/services/support.ts`
- Create: `merchant-mini/miniprogram/utils/support-polling.ts`
- Create: `merchant-mini/miniprogram/pages/messages/index.ts`
- Create: `merchant-mini/miniprogram/pages/messages/index.wxml`
- Create: `merchant-mini/miniprogram/pages/messages/index.wxss`
- Create: `merchant-mini/miniprogram/pages/messages/index.json`
- Create: `merchant-mini/miniprogram/pages/message-detail/index.ts`
- Create: `merchant-mini/miniprogram/pages/message-detail/index.wxml`
- Create: `merchant-mini/miniprogram/pages/message-detail/index.wxss`
- Create: `merchant-mini/miniprogram/pages/message-detail/index.json`
- Modify: `merchant-mini/miniprogram/app.json`
- Modify: `merchant-mini/miniprogram/components/app-tab-bar/navigation.ts`
- Modify: `merchant-mini/miniprogram/pages/workbench/index.ts`
- Test: `merchant-mini/tests/support-chat.spec.ts`
- Modify test: `merchant-mini/tests/navigation.spec.ts`
- Modify test: `merchant-mini/tests/top-level-ui.spec.ts`

**Interfaces:**
- Messages tab routes to `/pages/messages/index`.
- Conversation list shows customer display name, masked phone, preview, relative time, optional order context, and unread badge.
- Detail page supports OWNER/CASHIER replies, read acknowledgement, 10-second visible polling, and returning to the preserved list position.

- [ ] **Step 1: Write failing merchant service/navigation/polling/UI contracts**

Assert exact protected endpoints, page registration, real tab route, unread badge visibility, no badge for zero, masked-phone rendering, linked-order navigation, text validation, stable retry ID, one in-flight poll, polling shutdown on background/session loss, safe-area composer, local SVG icons, and no placeholder copy.

- [ ] **Step 2: Run merchant focused tests to verify RED**

Run: `npm test -- --run tests/support-chat.spec.ts tests/navigation.spec.ts tests/top-level-ui.spec.ts` from `merchant-mini`.

Expected: FAIL because the real messages pages and service do not exist and navigation still targets the placeholder.

- [ ] **Step 3: Implement merchant service, list page, and detail page**

Load conversations newest first, preserve scroll/list state across detail navigation, mark the conversation read after messages load, immediately patch preview/unread state through `eventChannel`, preserve reply text on error, and stop polling on hide/unload or invalid session.

- [ ] **Step 4: Connect dashboard and navigation**

Route the existing messages tab to the new list. Keep `waitingConversationCount` as the workbench count source and navigate the “待回复” metric to the messages list.

- [ ] **Step 5: Run merchant full verification**

Run: `npm test -- --run && npm run typecheck` from `merchant-mini`.

Expected: all merchant tests and typecheck pass.

- [ ] **Step 6: Commit the merchant slice**

```powershell
git add merchant-mini/miniprogram merchant-mini/tests
git commit -m "feat: add merchant support inbox"
```

### Task 5: Cross-client regression and local acceptance

**Files:**
- Modify: `docs/operations/trial-acceptance.md`
- Create: `docs/operations/customer-support-chat-local-testing.md`

**Interfaces:**
- Produces a local acceptance path: customer login → start order-linked chat → merchant sees unread → cashier replies → customer sees reply → both read counts clear.

- [ ] **Step 1: Run server full verification**

Run: `server\mvnw.cmd -f server\pom.xml clean verify`

Expected: Maven exit 0 and zero failures/errors.

- [ ] **Step 2: Run both mini-program full gates**

Run from each package: `npm test -- --run` and `npm run typecheck`.

Expected: both packages exit 0.

- [ ] **Step 3: Write local acceptance instructions**

Document test accounts, API startup, customer and merchant DevTools import roots, the full conversation scenario, retry/offline checks, privacy checks, and the known no-WebSocket/no-media limitations.

- [ ] **Step 4: Check the final diff and commit docs**

```powershell
git diff --check
git add docs/operations/trial-acceptance.md docs/operations/customer-support-chat-local-testing.md
git commit -m "docs: add support chat acceptance guide"
```

## Self-Review

- Spec coverage: customer entry, optional order linkage, merchant list/reply, unread/read, polling, permissions, idempotency, error recovery, privacy, and local acceptance each map to a task.
- Scope exclusions are explicit: no media, WebSocket, deletion, automation, or system-notification tab in this phase.
- Type consistency: both clients use conversation/message IDs from the same server views; sender side is consistently `CUSTOMER` or `MERCHANT`; all send paths require `clientMessageId`.
