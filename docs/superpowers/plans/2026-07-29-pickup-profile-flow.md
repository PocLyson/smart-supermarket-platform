# Pickup Profile Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Maintain pickup name and phone in Settings once, then automatically show and use them during checkout.

**Architecture:** Continue using `profileService` as the single API source of truth. Add a focused pickup-information page for editing, remove editing responsibilities from Profile, and make Checkout fetch the saved profile on every `onShow` so returning from an edit refreshes the order automatically.

**Tech Stack:** WeChat Mini Program, TypeScript, WXML/WXSS, Vitest.

## Global Constraints

- Browsing remains available without login.
- Pickup information can only be edited by a logged-in customer.
- Checkout displays saved information read-only and cannot submit without a valid name and 11-digit phone number.
- Existing cart, order, logout, and account-deletion behavior must remain unchanged.

---

### Task 1: Pickup Information Settings Page

**Files:**
- Create: `mini/miniprogram/pages/pickup-info/index.ts`
- Create: `mini/miniprogram/pages/pickup-info/index.wxml`
- Create: `mini/miniprogram/pages/pickup-info/index.wxss`
- Create: `mini/miniprogram/pages/pickup-info/index.json`
- Modify: `mini/miniprogram/pages/settings/index.ts`
- Modify: `mini/miniprogram/pages/settings/index.wxml`
- Modify: `mini/miniprogram/app.json`
- Test: `mini/tests/pickup-info-flow.spec.ts`

**Interfaces:**
- Consumes: `profileService.get(): Promise<CustomerProfile>` and `profileService.save(profile): Promise<CustomerProfile>`.
- Produces: `/pages/pickup-info/index`, opened by `settings.onPickupInfo()`.

- [ ] **Step 1: Write the failing route and page behavior test**

```ts
expect(appConfig.pages).toContain('pages/pickup-info/index')
expect(settingsMarkup).toContain('bindtap="onPickupInfo"')
expect(pickupSource).toContain('await profileService.get()')
expect(pickupSource).toContain('await profileService.save({')
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix mini test -- --run tests/pickup-info-flow.spec.ts`
Expected: FAIL because the route and page do not exist.

- [ ] **Step 3: Implement the settings route and editing page**

```ts
onPickupInfo() {
  wx.navigateTo({ url: '/pages/pickup-info/index' })
}
```

The page loads the saved profile in `onShow`, validates with `validateProfile`, saves through `profileService.save`, updates `sessionStore.profileComplete`, shows `取货信息已保存`, and navigates back.

- [ ] **Step 4: Run the focused test**

Run: `npm --prefix mini test -- --run tests/pickup-info-flow.spec.ts`
Expected: PASS.

### Task 2: Remove Profile Editing Form

**Files:**
- Modify: `mini/miniprogram/pages/profile/index.wxml`
- Modify: `mini/miniprogram/pages/profile/index.ts`
- Modify: `mini/miniprogram/pages/profile/index.json`
- Modify: `mini/miniprogram/pages/profile/index.wxss`
- Test: `mini/tests/pickup-info-flow.spec.ts`

**Interfaces:**
- Consumes: `profileService.get()` only.
- Produces: a read-only profile summary with no pickup form or save action.

- [ ] **Step 1: Add failing assertions**

```ts
expect(profileMarkup).not.toContain('保存取货信息')
expect(profileMarkup).not.toContain('bindinput="onPickupNameInput"')
expect(profileSource).not.toContain('profileService.save')
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix mini test -- --run tests/pickup-info-flow.spec.ts`
Expected: FAIL because Profile still owns the form.

- [ ] **Step 3: Remove form markup, save handlers, and unused component/style**

Keep `loadProfile()` so the header still shows the saved pickup name and masked phone.

- [ ] **Step 4: Run the focused test**

Run: `npm --prefix mini test -- --run tests/pickup-info-flow.spec.ts`
Expected: PASS.

### Task 3: Checkout Auto-Fill and Read-Only Display

**Files:**
- Modify: `mini/miniprogram/pages/checkout/index.ts`
- Modify: `mini/miniprogram/pages/checkout/index.wxml`
- Modify: `mini/miniprogram/pages/checkout/index.wxss`
- Test: `mini/tests/checkout.spec.ts`
- Test: `mini/tests/pickup-info-flow.spec.ts`

**Interfaces:**
- Consumes: `profileService.get()` whenever Checkout becomes visible.
- Produces: `pickupReady`, `profileLoading`, and a read-only pickup summary used by `checkout.updateContact`.

- [ ] **Step 1: Write failing auto-fill and missing-profile tests**

```ts
await checkoutPage.onShow.call(context)
expect(profileService.get).toHaveBeenCalled()
expect(context.setData).toHaveBeenCalledWith(expect.objectContaining({
  pickupName: '李松',
  phone: '18653045492',
  pickupReady: true,
}))
```

Also assert that submission is blocked and `/pages/pickup-info/index` is offered when the saved profile is incomplete.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm --prefix mini test -- --run tests/checkout.spec.ts tests/pickup-info-flow.spec.ts`
Expected: FAIL because Checkout still uses editable inputs.

- [ ] **Step 3: Implement automatic loading and read-only UI**

```ts
async onShow() {
  const profile = await profileService.get()
  this.setData({
    pickupName: profile.pickupName,
    phone: profile.phone,
    pickupReady: !validateCheckoutFields(profile.pickupName, profile.phone).pickupNameError,
  })
}
```

Replace the two inputs with information rows, add `修改` linking to `/pages/pickup-info/index`, and disable submission while loading or incomplete.

- [ ] **Step 4: Run focused tests**

Run: `npm --prefix mini test -- --run tests/checkout.spec.ts tests/pickup-info-flow.spec.ts`
Expected: PASS.

### Task 4: Regression Verification

**Files:**
- Verify all files changed above.

- [ ] **Step 1: Run all mini-program tests**

Run: `npm --prefix mini test -- --run`
Expected: all tests PASS.

- [ ] **Step 2: Run TypeScript validation**

Run: `npm --prefix mini run typecheck`
Expected: exit code 0.

- [ ] **Step 3: Check patch formatting**

Run: `git diff --check -- mini/miniprogram mini/tests`
Expected: no whitespace errors.

- [ ] **Step 4: Inspect the rendered flow**

Open Settings → Pickup Information, save a valid name and phone, return to Checkout, and confirm the latest values appear without editable fields.
