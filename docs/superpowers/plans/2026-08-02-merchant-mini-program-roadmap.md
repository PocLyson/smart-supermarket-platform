# Merchant Mini Program Roadmap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the independent “鲁能超市商家端” WeChat mini program, online payments, mobile operations, and customer messaging as separately testable production slices.

**Architecture:** Add a new native `merchant-mini/` client beside the existing customer `mini/` and admin `admin/`. All clients call the Spring Boot service; merchant-specific controllers under `/api/merchant-mini/**` adapt existing domain services without duplicating order, catalog, inventory, announcement, payment, or audit rules. The roadmap is split into four implementation plans because authentication/orders, funds, store operations, and real-time messaging have independent data models and failure modes.

**Tech Stack:** Java 17, Spring Boot 3.5.9, Spring Security, Spring Data JPA/JdbcTemplate, MySQL 8, Redis, Flyway, official WeChat Pay Java SDK 0.2.17, native WeChat Mini Program TypeScript, TDesign MiniProgram 1.15.3, Vitest 4, Testcontainers.

## Global Constraints

- Merchant mini program bottom navigation is exactly `工作台｜订单｜核销｜消息｜我的`.
- Merchant UI reuses the customer mini program’s navy token values from `mini/miniprogram/styles/theme.wxss`; no second brand palette.
- Roles remain `OWNER` (店长) and `CASHIER` (店员); every endpoint enforces the matrix in the approved design.
- Complete finance reports, reconciliation exports, and staff-account management stay in the desktop admin.
- Payment secrets, AppSecrets, APIv3 keys, and private keys never enter either mini-program bundle or Git.
- Monetary values are integer cents; inventory quantities are integers and never become negative.
- All write endpoints use `X-Request-Id` or a client message ID for idempotency and audit.
- Online payment/refund behavior follows `docs/superpowers/specs/2026-08-02-wechat-online-payment-design.md`.
- Merchant behavior, chat retention, and UI behavior follow `docs/superpowers/specs/2026-08-02-merchant-mini-program-design.md`.

---

## Delivery Sequence

### Phase 1: Merchant Foundation, Orders, and Pickup

Plan: `docs/superpowers/plans/2026-08-02-merchant-foundation-orders.md`

Produces a usable merchant mini program with staff-WeChat binding, client-scoped tokens, role-aware navigation, workbench, order list/detail, 15-second order reminders, pay-at-store confirmation, and pickup-code verification.

Release gate:

- Test `OWNER` and `CASHIER` can bind and sign in.
- Customer/admin tokens cannot call merchant endpoints.
- Both roles can process and verify orders; only owner can cancel.
- Existing customer and admin order tests stay green.

### Phase 2: WeChat Online Payment and Refund

Plan: `docs/superpowers/plans/2026-08-02-wechat-online-payment.md`

Adds customer payment choice, 15-minute payment expiry, WeChat APIv3 payment/refund records, callbacks, active query, close-order and refund compensation, customer payment/refund UI, and trusted payment/refund projections in merchant/admin order views.

Dependency: Phase 1 merchant order views and auth are complete.

Release gate:

- Pending online orders stay hidden from merchant queues.
- Client callbacks never decide payment success.
- Timeout, callback, cancel, and refund races are idempotent.
- A real low-value payment and refund reconcile with the WeChat merchant platform.

### Phase 3: Product, Inventory, Announcement, and Business Overview

Plan: `docs/superpowers/plans/2026-08-02-merchant-operations.md`

Adds owner product CRUD/image/shelf/archive/restore/permanent-delete actions, owner/cashier inventory adjustments and ledger, owner announcement management, and owner-only mobile business metrics.

Dependency: Phase 1 role-aware shell and HTTP client are complete. Phase 2 is required before production metrics are accepted, because paid/refunded amounts define the reporting contract.

Release gate:

- Permission matrix is enforced by API tests, not only hidden buttons.
- Product and inventory changes appear in customer and admin clients.
- Mobile metrics match the desktop source queries for the same time range.

### Phase 4: Real-Time Customer Service

Plan: `docs/superpowers/plans/2026-08-02-customer-service-messaging.md`

Adds ordinary and order-linked customer conversations, text/image moderation, private attachments, waiting queue, atomic claiming, owner transfer/close, WebSocket delivery, reconnect catch-up, unread cursors, retention jobs, and customer/merchant UI.

Dependency: Phase 1 client-scoped auth is complete. It can begin after Phase 1, but production release follows Phase 3 so workbench permission tiles and message badges ship together.

Release gate:

- Reconnect does not lose or duplicate messages.
- Customers cannot access another customer’s conversations or attachments.
- Two employees cannot claim the same waiting conversation.
- Moderation failure prevents delivery and returns an understandable message.

## Cross-Phase Verification

- [ ] Run server suite: `cd server; .\mvnw.cmd clean verify` and require `BUILD SUCCESS`.
- [ ] Run customer mini suite: `cd mini; npm test -- --run; npm run typecheck` and require all tests plus TypeScript pass.
- [ ] Run merchant mini suite: `cd merchant-mini; npm test -- --run; npm run typecheck` and require all tests plus TypeScript pass.
- [ ] Run admin suite: `cd admin; npm test -- --run; npm run build` and require all tests plus production build pass.
- [ ] Run `git diff --check` before every phase commit.
- [ ] Complete WeChat DevTools real-device acceptance for both mini programs.
- [ ] Update `docs/operations/trial-acceptance.md`, privacy policy, and WeChat privacy-protection guide before submission.

## Commit Strategy

Each task in the child plans ends in its own commit. Do not mix phases in one commit. Never stage the existing unrelated directories `docs/ui/audits/` or `mini/screenshots/release-audit/` unless a later user request explicitly places them in scope.
