# Final Fix B Report — Merchant Authentication Hardening

## Status

- Result: DONE
- Date: 2026-08-09
- Scope: server authentication rate limiting, merchant session storage/authentication, staff invalidation locking, and corresponding tests
- No pickup-code or order production code was modified.

## Root Cause and Linearization Model

### Password-login rate limiting

`RateLimitFilter.rule` matched admin login, customer WeChat login, and order creation, but not `POST /api/merchant-mini/auth/password-login`. The public merchant password endpoint therefore bypassed the existing fail-closed Redis login limiter entirely.

The original limiter also used wall-clock fixed buckets (`epochSeconds / windowSeconds`). A short request burst crossing a bucket boundary could exceed the configured limit and made the existing order limiter regression timing-dependent. Keys now use a first-request TTL window, which removes the boundary burst without weakening existing admin, customer, or order routes.

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
- Replaced fixed wall-clock rate-limit buckets with first-request TTL windows.
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
- `RateLimitFilterTest`: 3/3 passed after removing the wall-clock bucket boundary.

## Full Verification

Final fresh command:

```powershell
cd server
.\mvnw.cmd -q clean verify
```

Result:

- Maven exit code: `0`
- Surefire: 33 reports, 109 tests, 0 failures, 0 errors, 0 skipped
- `git diff --check`: exit `0`

An earlier full run exposed the fixed-bucket boundary weakness through one timing-dependent order limiter failure. The standalone test immediately passed, the key construction was corrected to a first-request TTL window, and the final full run above is the completion evidence.

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

- Intended subject: `fix: harden merchant authentication sessions`
