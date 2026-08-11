# Merchant Orders Status Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the merchant mini-program order list to match the selected status-board visual while preserving all existing query, filter, pagination, refresh, detail-navigation, and recovery behavior.

**Architecture:** Keep the existing page and service contracts. Add dashboard-summary data only for the three active-order counts, expose payment filters through a compact disclosure control, and reshape WXML/WXSS into a short navy header, summary strip, unified search row, horizontal status chips, timeline-like order list, and the existing floating navigation.

**Tech Stack:** WeChat Mini Program WXML/WXSS/TypeScript, TDesign Mini Program, Vitest.

## Global Constraints

- Preserve deep navy theme tokens and the existing five-item floating tab bar.
- Preserve order list context, loaded-page restoration, error recovery, pagination, and detail navigation.
- Use existing dashboard and order APIs; do not change server contracts.
- Keep all touch targets at least `88rpx` and all state information readable without relying on color alone.
- Do not stage `merchant-mini/project.config.json` or `merchant-mini/project.private.config.json`.

---

### Task 1: Status-board order list

**Files:**
- Modify: `merchant-mini/tests/orders.spec.ts`
- Modify: `merchant-mini/tests/top-level-ui.spec.ts`
- Modify: `merchant-mini/miniprogram/pages/orders/index.ts`
- Modify: `merchant-mini/miniprogram/pages/orders/index.wxml`
- Modify: `merchant-mini/miniprogram/pages/orders/index.wxss`
- Modify: `merchant-mini/miniprogram/pages/orders/index.json`
- Modify: `merchant-mini/miniprogram/services/http.ts`
- Modify: `merchant-mini/tests/auth.spec.ts`
- Create: `merchant-mini/miniprogram/assets/icons/{refresh-cw,search,list-filter,chevron-right,circle}.svg`
- Create: `design-qa.md`
- Create: `docs/ui/merchant-orders-status-board-{implementation,comparison}.png`

**Interfaces:**
- Consumes: `merchantDashboardService.summary()`, `merchantOrdersService.list()`, existing `ORDER_STATUS_TABS` and order presentation helpers.
- Produces: `activeCounts`, `isPaymentFilterOpen`, `loadActiveCounts()`, `togglePaymentFilter()`, and the selected status-board page presentation.

- [x] **Step 1: Write the failing layout and interaction tests**

Add assertions that the order page renders `order-summary-strip`, `summary-metric`, `filter-trigger`, `order-timeline`, and a compact custom header. Add a page-interaction test proving the payment filter disclosure toggles without changing the active payment filter.

- [x] **Step 2: Run the focused tests to verify RED**

Run: `npm test -- --run tests/orders.spec.ts tests/top-level-ui.spec.ts`

Expected: FAIL because the selected status-board classes and disclosure handler do not exist.

- [x] **Step 3: Implement the minimal page behavior**

Import `merchantDashboardService`; initialize active counts and disclosure state; load summary counts on first display and refresh; add a guarded `togglePaymentFilter()` that only opens or closes the payment choices.

- [x] **Step 4: Implement the selected visual structure**

Replace the tall hero and elevated all-in-one filter card with a compact navy header, white active-order summary strip, unified search/filter row, status chips, conditional payment choices, clean order timeline rows, and the existing floating navigation. Retain loading, empty, error, load-more, and end-of-list states.

- [x] **Step 5: Run focused and full automated verification**

Run: `npm test -- --run tests/orders.spec.ts tests/top-level-ui.spec.ts`

Run: `npm test -- --run`

Run: `npm run typecheck`

Expected: all commands exit `0` with no test failures or TypeScript errors.

- [x] **Step 6: Perform visual QA against selected option 2**

Open the selected source image and capture the order page at the matching mobile viewport in WeChat Developer Tools. Compare header height, summary proportions, search/filter alignment, chip rhythm, row density, type scale, colors, icons, copy, and floating navigation. Record evidence and the final result in `design-qa.md`; fix all P0/P1/P2 findings before handoff.

- [x] **Step 7: Commit the isolated change**

```powershell
git add -- docs/superpowers/plans/2026-08-11-merchant-orders-status-board.md design-qa.md merchant-mini/tests/orders.spec.ts merchant-mini/tests/top-level-ui.spec.ts merchant-mini/miniprogram/pages/orders/index.ts merchant-mini/miniprogram/pages/orders/index.wxml merchant-mini/miniprogram/pages/orders/index.wxss merchant-mini/miniprogram/pages/orders/index.json
git commit -m "feat: redesign merchant order management"
```
