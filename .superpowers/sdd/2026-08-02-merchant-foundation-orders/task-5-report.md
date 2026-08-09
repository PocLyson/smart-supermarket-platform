# Task 5 Report: Pickup Verification Page

## Status

DONE with an unrelated server verification failure recorded below.

## Implemented

- Added the native merchant pickup-verification page and registered it in the mini-program.
- Accepted keyboard input and `wx.scanCode({ scanType: ['qrCode'] })` results only when they are a plain six-digit code; signed, URL, JSON, alphabetic, and short payloads are rejected locally without a server request.
- Added a read-only order preview before mutation, showing order number, masked pickup name and phone, amount, payment state, and item summary.
- Hid collection controls for paid orders. Unpaid orders require an explicit `CASH` or `WECHAT_QR` selection.
- Required a second modal confirmation before `POST /api/merchant-mini/orders/{orderNo}/verify-pickup`.
- Added loading/disabled guards, duplicate-submit prevention, recoverable Chinese error messages, and distinct INPUT/CONFIRM/SUCCESS states.
- Added “继续核销” and “查看订单” success actions, including clean navigation history when continuing from an order-detail entry.
- Added order-detail entry with order-number prefill. Successful verification updates the detail immediately, emits the existing list update event, and relies on existing `onShow` reload behavior for list/workbench freshness.
- Replaced the verification placeholder tab target with the real native page.
- Followed the existing deep-navy theme tokens, 44px touch targets, safe-area spacing, local SVG navigation icon, and no emoji.

## TDD Evidence

Initial focused run:

```text
npm test -- --run tests/pickup-verification.spec.ts
Test Files  1 failed (1)
Tests       7 failed (7)
```

Expected RED causes were the missing verification module/page and missing `service.verifyPickup` boundary.

Additional RED/GREEN cycles covered masked pickup identity plus disabled unpaid confirmation, and clean history for “继续核销” after entering from order detail.

Final focused behavior is included in the full merchant suite below (8 pickup-verification tests).

## Verification

### Passed

```text
merchant-mini: npm test -- --run
Test Files  7 passed (7)
Tests       82 passed (82)

merchant-mini: npm run typecheck
exit 0

mini: npm test -- --run
Test Files  36 passed (36)
Tests       141 passed (141)

mini: npm run typecheck
exit 0

Static/config checks
Validated 10 JSON files, page registration, navigation, and diff whitespace
```

### Server verification not passing (unrelated existing context failure)

`server/.\mvnw.cmd clean verify` did not complete successfully. The generated Surefire reports show:

```text
tests=94 failures=0 errors=5 skipped=0 files=28
```

The five errors are ApplicationContext startup errors in `InventoryServiceTest` (1), `OrderApplicationServiceTest` (3), and `SmartStoreApplicationTest` (1). The root cause is:

```text
No qualifying bean of type
com.luneng.smartstore.merchantauth.StaffWechatBindingRepository available
```

Task 5 changes only merchant mini-program TypeScript/WXML/WXSS/JSON and tests; no server source or test files were changed.

## Files

- `merchant-mini/miniprogram/pages/verify-pickup/index.ts`
- `merchant-mini/miniprogram/pages/verify-pickup/index.wxml`
- `merchant-mini/miniprogram/pages/verify-pickup/index.wxss`
- `merchant-mini/miniprogram/pages/verify-pickup/index.json`
- `merchant-mini/miniprogram/pages/verify-pickup/verification.ts`
- `merchant-mini/miniprogram/services/orders.ts`
- `merchant-mini/miniprogram/components/app-tab-bar/navigation.ts`
- `merchant-mini/miniprogram/pages/order-detail/index.ts`
- `merchant-mini/miniprogram/pages/order-detail/index.wxml`
- `merchant-mini/miniprogram/app.json`
- `merchant-mini/tests/pickup-verification.spec.ts`
- `merchant-mini/tests/navigation.spec.ts`
