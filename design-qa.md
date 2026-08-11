# 商家小程序工作台 Design QA

## Evidence

- Source visual truth: `C:\Users\k\.codex\generated_images\019fa442-921b-77e3-9dc4-8c3354447a37\exec-3221c7d5-7a31-491b-8f21-e6aca399bd86.png`
- Implementation screenshot: `C:\Users\k\Documents\智慧超市平台\.worktrees\merchant-mini-phase1\design-qa-implementation.png`
- Full-view comparison: `C:\Users\k\Documents\智慧超市平台\.worktrees\merchant-mini-phase1\design-qa-comparison.png`
- Focused floating-navigation comparison: `C:\Users\k\Documents\智慧超市平台\.worktrees\merchant-mini-phase1\design-qa-focused-bottom.png`
- Runtime: 微信开发者工具 Stable 2.01.2510290, iPhone 12/13 simulator, WeChatLib 3.17.0.
- State: authenticated `cashier1` / 收银员, workbench loaded from the local API with live dashboard and order data.

## Viewport and normalization

- Source pixels: 853 × 1844.
- Implementation window capture: 1251 × 1000; simulator region cropped from the DevTools window at 365 × 789 logical pixels.
- App CSS viewport reported by DevTools: 390 × 844.
- Density normalization: source and cropped implementation were both resampled to 390 × 844 before the side-by-side comparison.
- Runtime-owned status bar, notch, WeChat capsule and home indicator are present only in the implementation and were not treated as app-owned design drift.

## Full-view comparison

The final comparison confirms the same major composition as the approved visual: deep-navy identity header, priority queue card, three utility actions, three-column daily overview, recent-order list, and a floating white five-item dock. The main information hierarchy and above-the-fold density remain intact at 390 × 844; the floating dock overlays the recent-order region in the same intended way as the source.

## Focused comparison

The focused bottom-region comparison verifies the requested change specifically: the navigation is detached from the screen edges, has a rounded white dock and shadow, preserves five equally distributed destinations, and elevates the center 核销 action in a 48px navy circle. The workbench active indicator, labels, safe-area spacing and home indicator do not collide.

## Required fidelity surfaces

- Fonts and typography: system PingFang/WeChat stack, bold section hierarchy, tab labels and numeric emphasis correspond to the reference. No clipping or unintended wrapping remains. The live order numbers are longer than the mock data but remain contained.
- Spacing and layout rhythm: 16px dock side margins, 12px safe-area gap, 24px dock radius, card groups and 44px minimum touch targets are preserved. The custom header was expanded after device testing so employee controls sit below the WeChat capsule.
- Colors and visual tokens: primary navy uses the existing `#082F6B` token; white surfaces, `#F7F9FC` page background and red/blue/green queue semantics match the approved direction and retain readable contrast.
- Image and icon fidelity: all visible icons use bundled local linear SVG assets. The implementation uses the closest existing project icons for stock/product/announcement concepts rather than introducing handcrafted SVG or CSS art. This is an acceptable P3 asset variation from the generated concept.
- Copy and content: 工作台、鲁能超市李老家分店、优先处理、扫码核销、商品管理、发布公告、今日概览、最近订单 and all five tab labels match the approved Chinese copy. Counts and orders intentionally use live API data rather than mock values.

## Interaction and console checks

- Clicked the floating 核销 action: it opened `/pages/verify-pickup/index` and visibly selected 核销.
- Clicked 工作台 from the floating dock: it returned to `/pages/workbench/index` and restored the selected state.
- Existing queue, shortcut and all-order handlers are covered by the workbench contract tests.
- DevTools reported 0 runtime errors. A historical WXSS warning exposed during iteration 2 was fixed by replacing tag-descendant selectors with class selectors; the final source contract prevents its return. Remaining DevTools notices are environment/base-library informational warnings.

## Comparison history

### Iteration 1

- P1: the employee pill overlapped the runtime-owned WeChat capsule in the first device capture.
- Fix: increased the custom header safe top region to 300rpx, moved content below the capsule, and compacted the employee pill while retaining a 44px target.
- Post-fix evidence: `design-qa-implementation.png` and the right side of `design-qa-comparison.png` show the pill fully below and separate from the capsule.

### Iteration 2

- P2: page WXSS used a tag-descendant selector for priority icons, producing a DevTools compile warning.
- Fix: added explicit `priority-icon-image` tone classes and a regression test that rejects the unsupported selector.
- Post-fix evidence: final automated tests and typecheck pass; hot reload renders all priority icons and no new selector warning is emitted.

## Findings

- No actionable P0, P1 or P2 mismatch remains.
- P3 follow-up: if a dedicated project icon set is added later, the 商品管理 and 发布公告 icons can be replaced with box and megaphone glyphs closer to the concept image.

## Implementation checklist

- [x] Approved workbench hierarchy implemented.
- [x] Floating five-item navigation implemented globally.
- [x] Center 48px navy 核销 action implemented and exercised.
- [x] Runtime capsule and safe-area behavior verified.
- [x] Loading, recoverable error and empty states retained.
- [x] Automated regression and typecheck completed.

final result: passed
