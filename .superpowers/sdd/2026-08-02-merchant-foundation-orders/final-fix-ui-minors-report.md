# Final Fix C Report — Merchant UI Interaction Gaps

## Status

- Result: DONE
- Date: 2026-08-09
- Scope: merchant order-detail interaction locking, merchant WeChat unbind service/profile flow, and corresponding merchant-mini tests only

## Summary

- Acquires the order mutation lock before opening either the payment action sheet or owner cancellation modal. Deferred rapid double taps now create one prompt and at most one request.
- Keeps the authoritative successful mutation response when the optional follow-up detail refresh fails late, so a refresh error cannot replace the successful UI state.
- Connects the existing `DELETE /api/merchant-mini/account/wechat-binding` endpoint to the merchant profile for both `OWNER` and `CASHIER`, matching server authorization semantics.
- Requires explicit native confirmation and explains that the next login must bind again. The profile exposes loading, error, and success feedback while preventing logout/unbind overlap.
- Clears the merchant session and stops merchant reminders only after successful unbind. A failed unbind retains the merchant session; customer session storage is never touched.
- Reuses the existing navy semantic tokens, TDesign controls, safe-area page shell, and 88rpx minimum touch target. No icons, emoji, or page-local hexadecimal colors were added.

## TDD Evidence

### Order prompt locking RED

Command:

`npm test -- --run tests/orders.spec.ts -t "locks before a deferred"`

Observed RED: both tests failed because `showActionSheet` and `showModal` were each called twice during deferred double taps.

### Order late-refresh RED

Command:

`npm test -- --run tests/orders.spec.ts -t "follow-up detail refresh fails late"`

Observed RED: the late refresh error replaced the empty success error state with `late refresh failure`.

### Unbind service RED

Command:

`npm test -- --run tests/auth.spec.ts -t "unbind"`

Observed RED: three tests failed because `unbindWechat` was absent.

### Profile flow RED

Command:

`npm test -- --run tests/profile.spec.ts`

Observed RED: the OWNER, CASHIER, and failure-flow tests all failed because the confirmed unbind entry point was absent.

### Focused GREEN

- Deferred payment/cancel locks: 3 focused order tests passed, including late-refresh containment.
- Auth unbind service: 3 tests passed for OWNER/CASHIER success and failure retention.
- Profile unbind interaction: 3 tests passed for both roles, deferred confirmation/loading/success, and recoverable error feedback.

## Final Verification

- `npm test -- --run`: PASS — 8 files, 98 tests
- `npm run typecheck`: PASS — `tsc --noEmit`
- UI static scan: PASS — no emoji or page-local hexadecimal palette in the changed profile/order-detail pages
- `git diff --check`: PASS
- Cached diff review: only the explicitly listed merchant-mini files and this report were staged; concurrent server changes were excluded

## Files

- `merchant-mini/miniprogram/pages/order-detail/index.ts`
- `merchant-mini/miniprogram/pages/profile/index.ts`
- `merchant-mini/miniprogram/pages/profile/index.wxml`
- `merchant-mini/miniprogram/pages/profile/index.wxss`
- `merchant-mini/miniprogram/services/auth.ts`
- `merchant-mini/tests/auth.spec.ts`
- `merchant-mini/tests/orders.spec.ts`
- `merchant-mini/tests/profile.spec.ts`
- `.superpowers/sdd/2026-08-02-merchant-foundation-orders/final-fix-ui-minors-report.md`

## Remaining Minor

- The previously documented fixed inactive/active SVG color difference remains unchanged, as allowed by the brief. Navigation was not redesigned.
- Customer mini tests/typecheck were not required because no shared utilities or customer files changed.
- No server files were modified or included by this fix.
