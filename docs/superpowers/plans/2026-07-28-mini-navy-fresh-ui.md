# Mini Program Navy Fresh UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the existing WeChat mini program UI to match the approved 21-screen navy fresh-grocery visual set while preserving every existing API contract and business behavior.

**Architecture:** Keep the current native WeChat page and service structure. Centralize the approved palette, spacing, radii, typography, safe-area, feedback, and image-fallback rules in shared WXSS; reuse the existing `app-tab-bar` component for the floating four-tab capsule; add only presentation helpers and a dedicated authorization page where the approved flow requires them.

**Tech Stack:** Native WeChat Mini Program, TypeScript 5.9, WXSS/WXML, TDesign Mini Program 1.15.3, Vitest 4.

## Global Constraints

- Visual truth: `C:/Users/k/.codex/visualizations/2026/07/28/019fa75c-a9ab-7923-8080-0778e09e1da2/mini-ui/navy-fresh-complete/`.
- Primary `#082F6B`; text `#0D1B36`; page `#F7F9FC`; card `#FFFFFF`; success `#2E9B62`; price/promotion `#E5484D`; border `#E7ECF3`.
- Official store name is always `鲁能超市李老家分店`.
- Primary tabs are only 首页 / 分类 / 购物车 / 我的; orders stay under 我的.
- Secondary pages do not show the primary tab bar.
- Preserve existing services, APIs, stores, server/admin/database code, and AppID.
- Never modify or stage `mini/project.config.json`.
- Use local SVG icons, never emoji; product images must expose loading/error fallbacks.
- Interactive targets are at least 88rpx (44px), and fixed UI reserves safe-area and scroll space.

---

### Task 1: Lock the Approved Visual Contract

**Files:**
- Modify: `mini/tests/home-visual-contract.spec.ts`
- Modify: `mini/tests/profile.spec.ts`
- Modify: `mini/tests/ui-presentation.spec.ts`
- Create: `mini/tests/navy-fresh-ui-contract.spec.ts`

**Interfaces:**
- Consumes: current WXML/WXSS and pure presentation helpers.
- Produces: failing tests for palette, navigation geometry, page registration, image fallback, login copy, order filters, state surfaces, and official store naming.

- [ ] **Step 1: Write failing contract tests**

```ts
expect(theme).toContain('--primary-600: #082F6B;')
expect(tabBar).toContain('border-radius: var(--radius-round)')
expect(profile).toContain('登录 / 注册')
expect(orders).toContain('order-filter is-active')
expect(allCustomerCopy).not.toMatch(/(?<!鲁能超市)李老家分店/)
```

- [ ] **Step 2: Run tests to verify RED**

Run: `cd mini && npm test -- --run`
Expected: FAIL on burgundy tokens, old logged-out copy, non-floating tab bar, missing auth page, and missing image-error states.

- [ ] **Step 3: Keep business tests unchanged**

Run: `cd mini && npm test -- --run tests/cart.spec.ts tests/catalog.spec.ts tests/checkout.spec.ts tests/http.spec.ts tests/order-status.spec.ts`
Expected: PASS, proving the red tests are UI contract failures rather than API regressions.

---

### Task 2: Build the Shared Navy Design System and Assets

**Files:**
- Modify: `mini/miniprogram/app.json`
- Modify: `mini/miniprogram/app.wxss`
- Modify: `mini/miniprogram/styles/theme.wxss`
- Modify: `mini/miniprogram/styles/components.wxss`
- Modify: `mini/miniprogram/components/app-tab-bar/index.wxml`
- Modify: `mini/miniprogram/components/app-tab-bar/index.wxss`
- Modify: `mini/miniprogram/assets/icons/*-active.svg`
- Create: `mini/miniprogram/assets/home/navy-fresh-grocery-hero.png`
- Create: `mini/miniprogram/assets/icons/image-placeholder.svg`

**Interfaces:**
- Consumes: existing CSS variables and tab navigation behavior.
- Produces: semantic navy tokens, floating capsule navigation, reusable cards/buttons/states, and reliable local imagery.

- [ ] **Step 1: Replace burgundy semantic tokens**

Set primary, surface, text, border, green, red-price, shadow, safe-area, and spacing variables to the approved values. Keep TDesign variables mapped to the same semantic tokens.

- [ ] **Step 2: Implement the floating capsule tab bar**

Use fixed `left/right: 36rpx`, `bottom: calc(20rpx + env(safe-area-inset-bottom))`, `min-height: 132rpx`, rounded white container, light border, soft shadow, four equal 88rpx hit targets, and an inner light-blue active capsule.

- [ ] **Step 3: Add real local photography and fallback assets**

Generate the navy fresh produce hero without text or logos, retain existing real category photography, and add a neutral line-art image fallback.

- [ ] **Step 4: Run the focused visual contract**

Run: `cd mini && npm test -- --run tests/home-visual-contract.spec.ts tests/navy-fresh-ui-contract.spec.ts`
Expected: shared-token and navigation assertions pass.

---

### Task 3: Rebuild Discovery Pages

**Files:**
- Modify: `mini/miniprogram/pages/home/index.{ts,wxml,wxss,json}`
- Modify: `mini/miniprogram/pages/category/index.{ts,wxml,wxss,json}`
- Modify: `mini/miniprogram/pages/search/index.{ts,wxml,wxss,json}`
- Modify: `mini/miniprogram/pages/product/index.{ts,wxml,wxss}`

**Interfaces:**
- Consumes: `catalogService`, `formatMoney`, `cartStore`, shared tokens and assets.
- Produces: approved home, compact horizontal category strip, search initial/results/empty, product detail, and image error recovery.

- [ ] **Step 1: Implement home and category**

Match the approved header/search proportions, real photo hero, five visible high-frequency categories including 烟酒, product-first cards, compact selected category pill, floating tabs, and widened vertical rhythm.

- [ ] **Step 2: Implement search states**

Keep keyword/history behavior, render initial suggestions, result list, empty/error/loading states, and the filter sheet entry without adding backend dependencies.

- [ ] **Step 3: Implement product detail**

Use a large contained product photo, green inventory, red price, store pickup line, 88rpx quantity controls, and a safe-area purchase bar with cart/add actions.

- [ ] **Step 4: Verify discovery tests**

Run: `cd mini && npm test -- --run tests/catalog.spec.ts tests/home-search.spec.ts tests/home-visual-contract.spec.ts tests/navy-fresh-ui-contract.spec.ts`
Expected: PASS.

---

### Task 4: Rebuild Cart, Checkout, Result, Authorization, and Feedback States

**Files:**
- Modify: `mini/miniprogram/pages/cart/index.{ts,wxml,wxss,json}`
- Modify: `mini/miniprogram/pages/checkout/index.{ts,wxml,wxss}`
- Modify: `mini/miniprogram/pages/submit-result/index.{ts,wxml,wxss,json}`
- Create: `mini/miniprogram/pages/auth/index.{ts,wxml,wxss,json}`
- Modify: `mini/miniprogram/pages/profile/index.ts`
- Modify: `mini/miniprogram/app.json`

**Interfaces:**
- Consumes: cart/checkout/session stores and existing auth/order services.
- Produces: populated/empty cart, delete confirmation, quantity controls, pickup-only checkout validation, submit success/uncertain recovery, and explicit WeChat authorization.

- [ ] **Step 1: Implement cart states and overlays**

Preserve cart store mutations; style selected rows, quantity stepper, deletion modal, empty/error/loading views, fixed checkout summary, and floating cart tab without content overlap.

- [ ] **Step 2: Implement pickup-only checkout**

Keep current validation helper and order submission. Show labeled fields, inline validation, official store card, item summary, disabled/loading submit states, and safe bottom action spacing.

- [ ] **Step 3: Implement result recovery and auth**

Render success and uncertain/failure result states from query data. Add `/pages/auth/index`, call the existing `authService.loginWithWechat`, and return to the invoking page without changing authentication contracts.

- [ ] **Step 4: Verify transaction tests**

Run: `cd mini && npm test -- --run tests/cart.spec.ts tests/checkout.spec.ts tests/profile.spec.ts tests/ui-presentation.spec.ts tests/navy-fresh-ui-contract.spec.ts`
Expected: PASS.

---

### Task 5: Rebuild Profile and Order Pages

**Files:**
- Modify: `mini/miniprogram/pages/profile/presentation.ts`
- Modify: `mini/miniprogram/pages/profile/index.{ts,wxml,wxss,json}`
- Modify: `mini/miniprogram/pages/orders/index.{ts,wxml,wxss,json}`
- Modify: `mini/miniprogram/pages/order-detail/index.{ts,wxml,wxss}`

**Interfaces:**
- Consumes: session/profile/order services and existing status helpers.
- Produces: logged-out header CTA, logged-in profile, order-status shortcuts, official store service card, equal-width order filters, empty/loading/error states, pickup code and status timeline.

- [ ] **Step 1: Implement profile header login**

Logged-out copy is `登录 / 注册` plus `同步订单与购物车`; the 88rpx WeChat login target lives in the navy header. Remove the duplicate lower login card and place order shortcuts immediately above store service.

- [ ] **Step 2: Implement order list filters**

Expose 全部 / 待确认 / 备货中 / 待取货 as equal-width targets; active 全部 uses a light-blue capsule and navy text. Keep service calls and order cards intact and use the full store name.

- [ ] **Step 3: Implement order detail**

Show state hero, pickup code for ready orders, official store, product imagery/fallback, amount, chronological timeline, cancellation confirmation, and recovery states.

- [ ] **Step 4: Verify profile/order tests**

Run: `cd mini && npm test -- --run tests/profile.spec.ts tests/order-status.spec.ts tests/ui-presentation.spec.ts tests/navy-fresh-ui-contract.spec.ts`
Expected: PASS.

---

### Task 6: Compile and Run Design QA

**Files:**
- Modify: `mini/design-qa.md`
- Create: `mini/screenshots/navy-fresh-final/*.png`

**Interfaces:**
- Consumes: all implemented pages and approved reference PNGs.
- Produces: fresh verification evidence and same-viewport visual comparisons.

- [ ] **Step 1: Run full automated verification**

Run:

```powershell
cd mini
npm test -- --run
npm run typecheck
```

Expected: all tests pass and TypeScript exits 0.

- [ ] **Step 2: Build NPM and compile in WeChat DevTools**

Use the installed WeChat DevTools CLI with the existing `mini/project.config.json`; do not edit the file. Build NPM, compile, and confirm the console has no errors.

- [ ] **Step 3: Capture every PAGE-LIST state**

Capture 390 × 844 screenshots for all reachable formal pages and visual states into `mini/screenshots/navy-fresh-final/`.

- [ ] **Step 4: Run design QA**

Create same-size side-by-side comparisons against the approved source PNGs, fix all P0/P1/P2 issues, repeat capture, and write `mini/design-qa.md` ending with `final result: passed` or `final result: blocked`.

---

### Task 7: Final Branch Verification and Commit

**Files:**
- Review: all modified files under `mini/`
- Exclude: `mini/project.config.json`

**Interfaces:**
- Consumes: verified implementation.
- Produces: one clear commit on `codex/mini-ui-complete`.

- [ ] **Step 1: Review scope**

Run: `git status --short` and `git diff --check`.
Expected: no server/admin/database/interface changes and no `mini/project.config.json` change.

- [ ] **Step 2: Re-run full verification immediately before commit**

Run: `cd mini && npm test -- --run && npm run typecheck`.
Expected: exit 0 with fresh output.

- [ ] **Step 3: Commit**

```powershell
git add mini docs/superpowers/plans/2026-07-28-mini-navy-fresh-ui.md
git restore --staged mini/project.config.json
git commit -m "feat(mini): implement approved navy fresh UI"
```

