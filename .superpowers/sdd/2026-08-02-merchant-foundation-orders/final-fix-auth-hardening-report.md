# Final Fix B Report — Merchant Authentication Hardening

## Status

- Result: DONE
- Date: 2026-08-09
- Scope: server authentication rate limiting, merchant session storage/authentication, staff invalidation locking, and corresponding tests
- No pickup-code or order production code was modified.

## Root Cause and Linearization Model

### Password-login rate limiting

`RateLimitFilter.rule` matched admin login, customer WeChat login, and order creation, but not `POST /api/merchant-mini/auth/password-login`. The public merchant password endpoint therefore bypassed the existing fail-closed Redis login limiter entirely.

The original limiter used wall-clock fixed buckets (`epochSeconds / windowSeconds`). The first hardening pass changed that to a counter whose TTL began on the first request, but this was still a fixed window: requests concentrated immediately before expiration and immediately after expiration could approach twice the configured rate in a short interval. It also performed `INCR` and `EXPIRE` separately, so an expiration failure after a successful increment could leave a permanent counter and permanent `429` responses.

Fix Round 1 replaces that counter with an atomic Redis Lua sliding window. The script removes expired ZSET entries, counts the remaining entries, decides whether to allow, records an allowed request with a unique member, and applies its TTL as one Redis operation.

### Merchant session revocation

Login replacement was already one Redis Lua operation, but logout, unbind, disable, and password reset used separate `GET`, session `DEL`, and staff-index `DEL` commands. A replacement between the read and deletes let an old operation delete the new staff index. Because `JwtAuthenticationFilter` checked only `auth:session:<sessionId>`, the new orphan session remained usable.

The final Redis linearization rules are:

- Login replacement: atomically delete the previously indexed session, write the new session, and point the staff index at it.
- Logout: atomically delete the expected old session and delete the staff index only when it still points at that expected session.
- Unbind, disable, and password reset: atomically revoke whichever session is current at script execution.
- Merchant authentication: atomically require both the staff index to point at the JWT session and the session value to equal the staff ID. A session without its index is not usable.

### Database/Redis race

Password and WeChat login validated database state before creating a Redis session, while unbind, disable, and password reset did not share a database lock with login. An invalidation could commit after the login's stale validation but before its Redis write, allowing an inactive account, old password, or invalidated binding to mint a usable session afterward.

All merchant login and staff invalidation paths now serialize on the same pessimistic `staff_account` row lock. If login linearizes first, the following invalidation revokes its session; if invalidation linearizes first, login observes the disabled/new-password/unbound state and cannot mint a session from stale credentials.

## Implementation

- Added `MerchantSessionStore` as the single Redis boundary for replace, expected-session revoke, current-session revoke, and dual-key merchant authentication. Every multi-key operation is Lua-atomic.
- Routed merchant password login through a dedicated IP-scoped rule using the existing staff-login limit and fail-closed `RATE_LIMITED` response contract.
- Replaced counter-based fixed windows with versioned sliding-window ZSET keys and one atomic Redis Lua operation.
- Added pessimistic staff-row repository queries and used them in merchant password login, WeChat login, unbind, employee disable, and password reset.
- Preserved one active merchant session per staff, explicit `MERCHANT_MINI` client scope, and legacy JWT client-type fallback for admin/customer tokens.
- Updated the two pre-existing merchant dashboard/order test token fixtures to write the required staff index. This is authentication-contract adaptation only; no order assertion or production order/pickup code changed.
- Each rate-limit integration test clears its own `rate-limit:*` keys in setup, so results do not depend on manual Redis cleanup.

## TDD Evidence

### RED

Focused command for the new regressions exited `1` with 7 failures and 0 errors:

- Merchant password attempt 11 returned `401` instead of `429`.
- A simulated unavailable Redis limiter allowed the merchant password request with `200` instead of fail-closing with `429`.
- A merchant session whose staff index was deleted remained authenticated (`200` instead of `401`).
- A fixed `GET -> replacement -> DEL` logout schedule deleted the replacement staff index.
- Login racing with unbind, disable, and password reset left each newly minted `auth:session:*` present.

The old dashboard/order fixtures then produced 6 stable authentication failures after dual-key enforcement because they manually created only the session key. The authorized fixture-only adaptation added the matching staff index and left business assertions unchanged.

### GREEN

- New focused regressions: 7/7 passed.
- Logout/replacement regression: 32 real Redis races retained the replacement as current.
- `MerchantAuthApiTest`: passed after per-test rate-limit key cleanup.
- `MerchantDashboardApiTest,MerchantOrderApiTest`: 6/6 passed after dual-key fixture adaptation.
- `RateLimitFilterTest`: 3/3 passed in the initial hardening pass; Fix Round 1 supersedes its counter-window implementation and expands the suite to 5/5.

## Fix Round 1: Atomic Sliding-Window Rate Limiting

### Root cause and timing model

- A first-request TTL counter is a fixed window. With a limit of 10, a caller can place requests near the original key expiry and issue another 10 immediately after expiry, producing a near-double burst.
- `INCR` followed by `EXPIRE` has no atomicity boundary. If the first command succeeds and the second fails, the string counter has no TTL and can reject that identity indefinitely.
- The order rule previously treated limiter failures as fail-open even though this security fix requires every limited route to fail closed.

### Atomic algorithm

Each request uses one Lua invocation against `rate-limit:v2:<scope>:<identity>`:

1. Use application-server `Clock` milliseconds; request input cannot supply or alter time.
2. `ZREMRANGEBYSCORE` removes entries at or before `now - window`.
3. `ZCARD` obtains the number of requests still inside the sliding window.
4. If the count is at the limit, return denied without recording the request and without refreshing TTL.
5. Otherwise, `ZADD` a unique `<millisecond>:<UUID>` member and `PEXPIRE` the key for the configured window, then return allowed.

The UUID suffix prevents same-millisecond concurrent requests from overwriting each other. Accepted requests refresh TTL so the key survives until the newest accepted record has aged out; rejected requests deliberately do not extend key lifetime. The `v2` key namespace avoids a Redis type collision with pre-deployment string counters while those old keys expire.

### RED

The expanded focused suite first exited `1` with 5 tests, 3 failures, and 0 errors:

- The boundary burst accepted all 10 requests after the original admin window expiry instead of only 1.
- Concurrent requests created a Redis `STRING` instead of an expiring `ZSET` with one entry per accepted request.
- A simulated successful `INCR` followed by failed `EXPIRE` left a permanent `rate-limit:*` key.

After the Lua implementation, expanding the backend-failure test to every route produced a second RED: the order route returned `200` instead of fail-closing with `429` when script execution failed.

### GREEN

- Focused command: `.\mvnw.cmd -q '-Dtest=RateLimitFilterTest' test`
- Result: exit `0`, 5 tests passed.
- The boundary schedule passed for admin login, merchant password login, customer WeChat login, and authenticated order creation.
- With a fixed `Clock`, 32 concurrent requests in the exact same millisecond allowed exactly 10 and persisted exactly 10 unique ZSET members with a positive TTL.
- Script failure returned `429` for all four limited routes and left no `rate-limit:*` key.

## Full Verification

Final fresh command:

```powershell
cd server
.\mvnw.cmd -q clean verify
```

Result:

- Maven exit code: `0`
- Surefire: 34 reports, 113 tests, 0 failures, 0 errors, 0 skipped
- `git diff --check`: exit `0`

The completion evidence above is a fresh, single-instance `clean verify` run after the sliding-window fix. Earlier tool-timeout runs were terminated and are not counted as verification evidence.

## Files

- `server/src/main/java/com/luneng/smartstore/auth/MerchantSessionStore.java`
- `server/src/main/java/com/luneng/smartstore/auth/JwtAuthenticationFilter.java`
- `server/src/main/java/com/luneng/smartstore/common/web/RateLimitFilter.java`
- `server/src/main/java/com/luneng/smartstore/merchantauth/MerchantAuthService.java`
- `server/src/main/java/com/luneng/smartstore/merchantauth/StaffWechatBindingRepository.java`
- `server/src/main/java/com/luneng/smartstore/staff/StaffAccountRepository.java`
- `server/src/main/java/com/luneng/smartstore/staff/StaffManagementService.java`
- `server/src/test/java/com/luneng/smartstore/auth/ClientTypeSecurityTest.java`
- `server/src/test/java/com/luneng/smartstore/common/web/RateLimitFilterTest.java`
- `server/src/test/java/com/luneng/smartstore/merchantauth/MerchantAuthApiTest.java`
- `server/src/test/java/com/luneng/smartstore/merchantauth/MerchantAuthConcurrencyTest.java`
- `server/src/test/java/com/luneng/smartstore/merchant/MerchantDashboardApiTest.java` (authentication fixture only)
- `server/src/test/java/com/luneng/smartstore/merchant/MerchantOrderApiTest.java` (authentication fixture only)
- `.superpowers/sdd/2026-08-02-merchant-foundation-orders/final-fix-auth-hardening-report.md`

## Commit

- Initial hardening commit: `65340b50a641bae1cf4cebf018520ac8ec486b00` (`fix: harden merchant authentication sessions`)
- Fix Round 1 intended subject: `fix: make rate limiting atomic and sliding`
