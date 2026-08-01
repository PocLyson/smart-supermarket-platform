# Customer Service Messaging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add secure text-and-image customer service conversations to the customer and merchant mini programs, including ordinary and order-linked conversations, employee claiming, owner transfer, unread counts, and resilient real-time delivery.

**Architecture:** Introduce a `supportchat` server module that owns conversation membership, assignment, ordered messages, read cursors, moderation state, and private attachments. REST is the source of truth for writes and catch-up reads; WebSocket only accelerates delivery. Customer and merchant clients share protocol concepts but keep separate API services and page implementations so staff permissions never leak into the customer bundle.

**Tech Stack:** Spring Boot 3.5.9, Spring Security, Spring WebSocket, Spring Data JPA/JdbcTemplate, MySQL 8, Redis, Flyway, native WeChat Mini Program TypeScript, TDesign MiniProgram 1.15.3, Vitest 4, Testcontainers.

## Global Constraints

- Supported message types are exactly `TEXT` and `IMAGE`; no voice, video, file, rich text, or payment credentials.
- Conversations are either `GENERAL` or `ORDER_LINKED`. An order-linked conversation must belong to the signed-in customer.
- Conversation status is `WAITING`, `ACTIVE`, or `CLOSED`; only one employee owns an active conversation.
- `OWNER` can claim, transfer, reassign, and close; `CASHIER` can claim, reply to, and close conversations assigned to that cashier.
- Images are private, authenticated resources and are not delivered until the server records a passed content-safety result.
- REST commits each message before WebSocket delivery. WebSocket loss must never lose or duplicate a message.
- Ordinary conversations are deleted or anonymized 180 days after closure. Order-linked conversations follow the order-record retention period and remain at least 3 years.
- Customer phone numbers, openids, access tokens, attachment URLs, and message bodies must not be written to application logs.

---

### Task 1: Persist Conversations, Messages, Assignment History, and Read Cursors

**Files:**
- Create: `server/src/main/resources/db/migration/V9__create_customer_service_messaging.sql`
- Create: `server/src/main/java/com/luneng/smartstore/supportchat/ConversationType.java`
- Create: `server/src/main/java/com/luneng/smartstore/supportchat/ConversationStatus.java`
- Create: `server/src/main/java/com/luneng/smartstore/supportchat/MessageType.java`
- Create: `server/src/main/java/com/luneng/smartstore/supportchat/ModerationStatus.java`
- Create: `server/src/main/java/com/luneng/smartstore/supportchat/CustomerServiceConversation.java`
- Create: `server/src/main/java/com/luneng/smartstore/supportchat/CustomerServiceMessage.java`
- Create: `server/src/main/java/com/luneng/smartstore/supportchat/ConversationAssignmentHistory.java`
- Create: `server/src/main/java/com/luneng/smartstore/supportchat/ConversationReadCursor.java`
- Create: `server/src/main/java/com/luneng/smartstore/supportchat/CustomerServiceAttachment.java`
- Create: `server/src/main/java/com/luneng/smartstore/supportchat/CustomerServiceConversationRepository.java`
- Create: `server/src/main/java/com/luneng/smartstore/supportchat/CustomerServiceMessageRepository.java`
- Test: `server/src/test/java/com/luneng/smartstore/supportchat/CustomerServicePersistenceTest.java`

**Interfaces:**
- Conversation columns include customer ID, optional order ID, type, status, assignee staff ID, last message sequence, last message time, closed time, and optimistic-lock version.
- Message columns include conversation ID, monotonic sequence, sender actor type/ID, client message ID, type, text or attachment ID, moderation status, and created time.
- Unique constraints: `(conversation_id, sequence)` and `(sender_actor_type, sender_actor_id, client_message_id)`.
- Read cursor key is `(conversation_id, actor_type, actor_id)` and stores the highest read sequence.

- [ ] **Step 1: Write failing migration/persistence tests**

Assert foreign keys reject a conversation for a missing customer/order, message sequences are unique, retrying a client message ID is unique, and an active conversation cannot reference a missing staff account.

- [ ] **Step 2: Add V9 schema with indexes for queues and catch-up reads**

Add indexes on `(status, updated_at)`, `(assignee_staff_id, status, updated_at)`, `(customer_id, updated_at)`, and `(conversation_id, sequence)`.

- [ ] **Step 3: Add enums, entities, and repositories**

Keep lifecycle transitions inside entity methods such as `claim`, `transfer`, `close`, and `advanceSequence`; do not expose public status setters.

- [ ] **Step 4: Run persistence tests**

```powershell
Set-Location server
.\mvnw.cmd -Dtest=CustomerServicePersistenceTest test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add server/src/main/resources/db/migration/V9__create_customer_service_messaging.sql server/src/main/java/com/luneng/smartstore/supportchat server/src/test/java/com/luneng/smartstore/supportchat/CustomerServicePersistenceTest.java
git commit -m "feat: persist customer service conversations"
```

---

### Task 2: Implement Customer and Merchant Conversation REST APIs

**Files:**
- Create: `server/src/main/java/com/luneng/smartstore/supportchat/CustomerConversationController.java`
- Create: `server/src/main/java/com/luneng/smartstore/supportchat/MerchantConversationController.java`
- Create: `server/src/main/java/com/luneng/smartstore/supportchat/CustomerServiceConversationService.java`
- Create: `server/src/main/java/com/luneng/smartstore/supportchat/ConversationView.java`
- Create: `server/src/main/java/com/luneng/smartstore/supportchat/MessageView.java`
- Create: `server/src/main/java/com/luneng/smartstore/supportchat/SendMessageRequest.java`
- Modify: `server/src/main/java/com/luneng/smartstore/auth/SecurityConfig.java`
- Test: `server/src/test/java/com/luneng/smartstore/supportchat/CustomerConversationApiTest.java`
- Test: `server/src/test/java/com/luneng/smartstore/supportchat/MerchantConversationApiTest.java`
- Test: `server/src/test/java/com/luneng/smartstore/supportchat/ConversationClaimConcurrencyTest.java`

**Interfaces:**
- Customer: `POST /api/mini/customer-service/conversations`, `GET /api/mini/customer-service/conversations`, `GET /api/mini/customer-service/conversations/{id}`, `GET /api/mini/customer-service/conversations/{id}/messages?afterSequence=`, `POST .../messages`, and `PUT .../read-cursor`.
- Merchant: `GET /api/merchant-mini/customer-service/waiting`, `GET /api/merchant-mini/customer-service/conversations`, `POST .../{id}/claim`, `POST .../{id}/transfer`, `POST .../{id}/close`, `GET .../{id}/messages`, `POST .../{id}/messages`, and `PUT .../{id}/read-cursor`.
- Response includes `lastSequence`, `lastReadSequence`, `unreadCount`, assignment display name, order summary when linked, and server time.

- [ ] **Step 1: Write failing authorization and lifecycle tests**

Cover customer ownership, order ownership, cashier assignment, owner transfer, closed-conversation write rejection, and customer/admin tokens rejected from merchant endpoints.

- [ ] **Step 2: Implement idempotent message writes and ordered reads**

Within one transaction, lock the conversation, return the existing message for a repeated client message ID, otherwise increment `last_message_sequence`, persist the message, and update conversation activity time.

- [ ] **Step 3: Implement atomic first-claim semantics**

Use a versioned update or row lock so two employees cannot claim the same waiting conversation. The loser receives HTTP `409 CONVERSATION_ALREADY_CLAIMED` and the winning assignee summary.

- [ ] **Step 4: Enforce role and ownership rules in the service**

Controllers pass the authenticated principal; the service independently verifies every customer, order, staff role, assignee, transfer target, and state transition.

- [ ] **Step 5: Run API and concurrency tests**

```powershell
Set-Location server
.\mvnw.cmd -Dtest=CustomerConversationApiTest,MerchantConversationApiTest,ConversationClaimConcurrencyTest test
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add server/src/main/java/com/luneng/smartstore/supportchat server/src/main/java/com/luneng/smartstore/auth/SecurityConfig.java server/src/test/java/com/luneng/smartstore/supportchat
git commit -m "feat: add customer service conversation APIs"
```

---

### Task 3: Add Private Image Attachments and WeChat Content Safety

**Files:**
- Create: `server/src/main/java/com/luneng/smartstore/supportchat/CustomerServiceAttachmentService.java`
- Create: `server/src/main/java/com/luneng/smartstore/supportchat/CustomerServiceAttachmentController.java`
- Create: `server/src/main/java/com/luneng/smartstore/supportchat/WechatContentSecurityClient.java`
- Create: `server/src/main/java/com/luneng/smartstore/supportchat/WechatContentSecurityProperties.java`
- Modify: `server/src/main/resources/application.yml`
- Modify: `server/src/main/java/com/luneng/smartstore/auth/SecurityConfig.java`
- Test: `server/src/test/java/com/luneng/smartstore/supportchat/CustomerServiceAttachmentApiTest.java`
- Test: `server/src/test/java/com/luneng/smartstore/supportchat/WechatContentSecurityClientTest.java`

**Interfaces:**
- `POST /api/mini/customer-service/attachments/images` and `/api/merchant-mini/customer-service/attachments/images` accept JPEG/PNG/WebP after client compression, enforce configured byte and dimension limits, and return an opaque attachment ID.
- `GET /api/customer-service/attachments/{id}` streams only after authentication, conversation membership verification, and moderation approval.
- `WechatContentSecurityClient.checkImage(...)` returns `APPROVED`, `REJECTED`, or a retryable failure; retryable failure leaves the attachment unavailable.

- [ ] **Step 1: Write failing upload, access-control, and moderation tests**

Cover MIME spoofing, oversized files, non-member download, pending-image denial, rejected-image denial, and approved-image streaming without exposing a filesystem path.

- [ ] **Step 2: Implement private storage and membership checks**

Store files outside the public image directory. Persist only generated storage keys and compute response headers server-side.

- [ ] **Step 3: Implement the content-safety adapter**

Read credentials from environment-backed configuration, apply bounded retry with timeout, and map provider failures to an explicit pending/retry state. Never accept client-provided moderation state.

- [ ] **Step 4: Connect approved attachments to image messages**

Reject image-message creation unless the attachment belongs to the same sender, is unused, is approved, and is then atomically bound to the conversation message.

- [ ] **Step 5: Run attachment tests**

```powershell
Set-Location server
.\mvnw.cmd -Dtest=CustomerServiceAttachmentApiTest,WechatContentSecurityClientTest test
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add server/src/main/java/com/luneng/smartstore/supportchat server/src/main/resources/application.yml server/src/test/java/com/luneng/smartstore/supportchat
git commit -m "feat: secure customer service image messages"
```

---

### Task 4: Add Authenticated WebSocket Delivery With REST Catch-Up

**Files:**
- Modify: `server/pom.xml`
- Create: `server/src/main/java/com/luneng/smartstore/supportchat/CustomerServiceWebSocketConfig.java`
- Create: `server/src/main/java/com/luneng/smartstore/supportchat/CustomerServiceWebSocketHandler.java`
- Create: `server/src/main/java/com/luneng/smartstore/supportchat/CustomerServiceHandshakeInterceptor.java`
- Create: `server/src/main/java/com/luneng/smartstore/supportchat/CustomerServiceEventPublisher.java`
- Test: `server/src/test/java/com/luneng/smartstore/supportchat/CustomerServiceWebSocketTest.java`
- Test: `server/src/test/java/com/luneng/smartstore/supportchat/CustomerServiceReconnectTest.java`

**Interfaces:**
- Add `spring-boot-starter-websocket`.
- Endpoint: `/ws/customer-service`; the handshake authenticates the same client-scoped session used by REST.
- Server events: `conversation.updated`, `message.created`, `read_cursor.updated`, and `conversation.assigned` with conversation ID, sequence/version, and server time.
- Clients reconnect, then call REST with `afterSequence` for each open conversation; events are hints rather than authoritative message storage.

- [ ] **Step 1: Write failing handshake, authorization, ordering, and reconnect tests**

Assert expired tokens fail, customer cannot subscribe to another customer conversation, cashier cannot subscribe before assignment, event sequence matches committed message sequence, and REST catch-up returns events missed during disconnect.

- [ ] **Step 2: Authenticate and authorize every socket subscription**

Resolve the session from Redis during handshake and re-check conversation membership before registering a subscription. Remove subscriptions on session invalidation or socket close.

- [ ] **Step 3: Publish only after transaction commit**

Use transaction synchronization or a domain event listener after commit. A rolled-back message must never produce a socket event.

- [ ] **Step 4: Add bounded heartbeat and cleanup**

Close dead sockets, cap subscriptions per session, and avoid logging message bodies or token query parameters.

- [ ] **Step 5: Run WebSocket tests**

```powershell
Set-Location server
.\mvnw.cmd -Dtest=CustomerServiceWebSocketTest,CustomerServiceReconnectTest test
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add server/pom.xml server/src/main/java/com/luneng/smartstore/supportchat server/src/test/java/com/luneng/smartstore/supportchat
git commit -m "feat: stream customer service messages"
```

---

### Task 5: Build the Customer Mini Program Message Center and Chat Page

**Files:**
- Create: `mini/miniprogram/types/customer-service.ts`
- Create: `mini/miniprogram/services/customer-service.ts`
- Create: `mini/miniprogram/services/customer-service-socket.ts`
- Create: `mini/miniprogram/pages/messages/index.json`
- Create: `mini/miniprogram/pages/messages/index.wxml`
- Create: `mini/miniprogram/pages/messages/index.wxss`
- Create: `mini/miniprogram/pages/messages/index.ts`
- Create: `mini/miniprogram/pages/conversation/index.json`
- Create: `mini/miniprogram/pages/conversation/index.wxml`
- Create: `mini/miniprogram/pages/conversation/index.wxss`
- Create: `mini/miniprogram/pages/conversation/index.ts`
- Modify: `mini/miniprogram/app.json`
- Modify: `mini/miniprogram/pages/profile/index.ts`
- Modify: `mini/miniprogram/pages/profile/index.wxml`
- Modify: `mini/miniprogram/pages/order-detail/index.ts`
- Modify: `mini/miniprogram/pages/order-detail/index.wxml`
- Modify: `mini/miniprogram/pages/merchant-contact/index.ts`
- Modify: `mini/miniprogram/pages/merchant-contact/index.wxml`
- Test: `mini/tests/customer-service-api.test.ts`
- Test: `mini/tests/customer-service-socket.test.ts`
- Test: `mini/tests/customer-service-pages.test.ts`

**Interfaces:**
- Profile exposes “消息中心” only after login and shows total unread count.
- Merchant contact starts or resumes a general conversation; order detail starts or resumes a conversation linked to that order.
- Chat sends text or one compressed image, renders send/pending/failed state, retries with the same client message ID, and catches up after reconnect.

- [ ] **Step 1: Write failing service, retry, and page-state tests**

Cover logged-out redirect, general/order-linked creation, idempotent retry, unread clearing, image upload failure, reconnect catch-up, and polling fallback.

- [ ] **Step 2: Implement REST and socket services**

Generate a stable client message ID before the first send. On reconnect, fetch messages after the highest rendered sequence and merge by server message ID/sequence.

- [ ] **Step 3: Build message center and conversation pages**

Reuse `mini/miniprogram/styles/theme.wxss`; show waiting, serving, and closed labels in customer language. Keep the composer above the safe area and provide an explicit resend affordance.

- [ ] **Step 4: Replace the existing contact entry behavior**

Do not expose the self-built message entry before login. Keep “拨打门店电话” as a separate authenticated action and remove any dependency on WeChat `open-type="contact"` for this flow.

- [ ] **Step 5: Run customer mini tests and typecheck**

```powershell
Set-Location mini
npm test -- customer-service-api.test.ts customer-service-socket.test.ts customer-service-pages.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add mini/miniprogram mini/tests/customer-service-api.test.ts mini/tests/customer-service-socket.test.ts mini/tests/customer-service-pages.test.ts
git commit -m "feat: add customer service messaging to customer mini"
```

---

### Task 6: Build the Merchant Message Queue, Conversation, Transfer, and Close Flows

**Files:**
- Create: `merchant-mini/miniprogram/types/customer-service.ts`
- Create: `merchant-mini/miniprogram/services/customer-service.ts`
- Create: `merchant-mini/miniprogram/services/customer-service-socket.ts`
- Create: `merchant-mini/miniprogram/pages/messages/index.json`
- Create: `merchant-mini/miniprogram/pages/messages/index.wxml`
- Create: `merchant-mini/miniprogram/pages/messages/index.wxss`
- Create: `merchant-mini/miniprogram/pages/messages/index.ts`
- Create: `merchant-mini/miniprogram/pages/conversation/index.json`
- Create: `merchant-mini/miniprogram/pages/conversation/index.wxml`
- Create: `merchant-mini/miniprogram/pages/conversation/index.wxss`
- Create: `merchant-mini/miniprogram/pages/conversation/index.ts`
- Create: `merchant-mini/miniprogram/pages/conversation-transfer/index.json`
- Create: `merchant-mini/miniprogram/pages/conversation-transfer/index.wxml`
- Create: `merchant-mini/miniprogram/pages/conversation-transfer/index.wxss`
- Create: `merchant-mini/miniprogram/pages/conversation-transfer/index.ts`
- Modify: `merchant-mini/miniprogram/app.json`
- Modify: `merchant-mini/miniprogram/custom-tab-bar/index.ts`
- Modify: `merchant-mini/miniprogram/pages/workbench/index.ts`
- Test: `merchant-mini/tests/customer-service-api.test.ts`
- Test: `merchant-mini/tests/customer-service-socket.test.ts`
- Test: `merchant-mini/tests/customer-service-pages.test.ts`

**Interfaces:**
- “消息” is the fourth bottom tab and shows a badge for waiting plus assigned unread conversations.
- List filters: waiting, mine, closed. Claim is optimistic in the UI but reconciles a `409` to the actual assignee.
- Both roles reply and close assigned conversations; only owner sees transfer/reassign controls.

- [ ] **Step 1: Write failing queue, permission, badge, and reconnect tests**

Cover concurrent-claim conflict display, cashier transfer control absence, owner transfer, close confirmation, unread badge aggregation, and missed-message recovery.

- [ ] **Step 2: Implement merchant services and socket lifecycle**

Open the socket after authenticated app foreground, back off reconnect attempts, suspend in background, and start incremental polling when repeated socket attempts fail.

- [ ] **Step 3: Build queue and conversation pages in the navy system**

Use compact operational density without shrinking touch targets below 44 CSS pixels. Surface linked order number/status at the top without exposing unrelated customer data.

- [ ] **Step 4: Add owner-only transfer/reassign UI**

Load active staff, show role and current workload, require confirmation, and refresh the current conversation after success.

- [ ] **Step 5: Run merchant mini tests and typecheck**

```powershell
Set-Location merchant-mini
npm test -- customer-service-api.test.ts customer-service-socket.test.ts customer-service-pages.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add merchant-mini/miniprogram merchant-mini/tests/customer-service-api.test.ts merchant-mini/tests/customer-service-socket.test.ts merchant-mini/tests/customer-service-pages.test.ts
git commit -m "feat: add merchant customer service workspace"
```

---

### Task 7: Add Retention, Privacy, Operations, and Real-Device Acceptance

**Files:**
- Create: `server/src/main/java/com/luneng/smartstore/supportchat/CustomerServiceRetentionJob.java`
- Create: `server/src/main/java/com/luneng/smartstore/supportchat/CustomerServiceRetentionProperties.java`
- Test: `server/src/test/java/com/luneng/smartstore/supportchat/CustomerServiceRetentionJobTest.java`
- Modify: `mini/miniprogram/pages/privacy-policy/index.wxml`
- Modify: `mini/miniprogram/pages/user-agreement/index.wxml`
- Modify: `docs/operations/deployment-runbook.md`
- Modify: `docs/operations/trial-acceptance.md`
- Create: `docs/operations/customer-service-messaging.md`

**Interfaces:**
- Daily job anonymizes or deletes ordinary closed conversations after 180 days and removes their attachments.
- Order-linked conversation retention derives from the order-retention cutoff and is never shorter than 3 years.
- Runbook documents WebSocket proxy upgrade headers, private attachment storage, content-safety credentials, retention job monitoring, and fallback polling alerts.

- [ ] **Step 1: Write failing retention boundary tests**

Use a fixed clock. Assert 179-day ordinary data remains, 181-day ordinary data is removed/anonymized, order-linked data under 3 years remains, and attachment deletion is idempotent.

- [ ] **Step 2: Implement retention with dry-run metrics**

Process bounded batches, log counts only, and emit success/failure metrics without message content or customer identifiers.

- [ ] **Step 3: Update privacy and agreement copy**

Disclose message text, images, linked order data, purpose, access scope, retention periods, deletion rules, and contact channel in plain Chinese. Keep the existing operator identity and contact details consistent.

- [ ] **Step 4: Document deployment and incident handling**

Include socket connectivity checks, content-safety outage behavior, storage capacity alerts, replay/idempotency diagnosis, and emergency disable switches.

- [ ] **Step 5: Run automated verification**

```powershell
Set-Location server
.\mvnw.cmd clean verify
Set-Location ..\mini
npm test
npm run typecheck
Set-Location ..\merchant-mini
npm test
npm run typecheck
Set-Location ..
git diff --check
```

Expected: every command passes and `git diff --check` has no output.

- [ ] **Step 6: Complete real-device acceptance**

Verify general and order-linked conversations, customer/employee background and reconnect, image rejection/approval, concurrent employee claim, owner transfer, close/reopen policy, unread badges, and fallback polling on two distinct WeChat devices.

- [ ] **Step 7: Commit**

```powershell
git add server/src/main/java/com/luneng/smartstore/supportchat server/src/test/java/com/luneng/smartstore/supportchat mini/miniprogram/pages/privacy-policy mini/miniprogram/pages/user-agreement docs/operations
git commit -m "docs: complete customer service messaging operations"
```
