# 商家小程序订单管理 Design QA

## Evidence

- Source visual truth: `C:\Users\k\.codex\generated_images\019fa442-921b-77e3-9dc4-8c3354447a37\exec-525479b6-9abb-49b2-ba8f-dc4af270882a.png`
- Implementation screenshot: `C:\Users\k\Documents\智慧超市平台\.worktrees\merchant-mini-phase1\docs\ui\merchant-orders-status-board-implementation.png`
- Side-by-side comparison: `C:\Users\k\Documents\智慧超市平台\.worktrees\merchant-mini-phase1\docs\ui\merchant-orders-status-board-comparison.png`
- Runtime: 微信开发者工具 Stable 2.01.2510290, iPhone 12/13 simulator, WeChatLib 3.17.0.
- State: authenticated `cashier1` / 收银员，连接本地 API，加载真实订单列表。

## Viewport and normalization

- Source pixels: 852 × 1864.
- Implementation simulator crop: 365 × 788 pixels from the DevTools window.
- The comparison scales the source to 365px width and places it beside the unscaled implementation crop.
- Runtime-owned status bar, notch, WeChat capsule and home indicator exist only in the implementation and are not app-owned drift.

## Required fidelity surfaces

- Hierarchy: deep-navy compact header, three-column active-order summary, search/filter row, horizontal status pills, timeline-like cards and floating five-item dock all match the selected direction.
- Typography: title, summary numbers, customer names, order totals and secondary metadata retain a clear four-level hierarchy without clipping.
- Spacing: 44px minimum controls, card padding, timeline gutter and safe-area dock spacing remain usable on the 365px simulator width.
- Color: existing `#082F6B` brand navy, white surfaces, light page background and semantic payment/status badges match the approved customer/merchant visual system.
- Icons: refresh, search, filter, timeline marker and chevron use bundled Lucide 0.468.0 SVG assets with ISC license comments. This removes the TDesign remote icon-font dependency that rendered missing-glyph squares in the first device capture.
- Data: summary counts and cards use the local API rather than mock values. The current dataset contains no active orders and several completed orders, so counts and status colors intentionally differ from the concept data.
- Search: the retained navy “查询” control comes from the previously approved interaction requirement; the concept’s navy filter treatment is also preserved.

## Interaction and runtime checks

- The initial real request reliably reproduced a server 500 because empty filters crossed the WeChat transport as literal `undefined` values.
- The merchant HTTP GET boundary now removes undefined query fields before transport; the same authenticated page subsequently loaded the real list successfully.
- Query, status chips, payment disclosure, refresh, pagination, detail navigation, error recovery and the floating navigation remain covered by Vitest contracts.
- No missing icon glyphs or new order-page runtime errors remain in the final device capture. Remaining DevTools notices are environment/base-library informational warnings.

## Comparison history

### Iteration 1

- P1: all new TDesign font icons appeared as missing-glyph squares when the external font could not be cached.
- Fix: replaced the five order-page glyphs with bundled Lucide SVG assets and added a static contract requiring the local licensed files.

### Iteration 2

- P1: real order loading failed because `status`, `paymentStatus` and `keyword` were serialized as the string `undefined`.
- Fix: added a failing merchant HTTP boundary test, compacted GET query objects, and confirmed the real list loaded.

### Iteration 3

- P2: the filter control was visually weaker than the selected option.
- Fix: changed it to a filled navy treatment with a white local filter icon while preserving its disclosure behavior.

## Findings

- No actionable P0, P1 or P2 mismatch remains.
- P3 accepted variation: the implementation keeps the explicit “查询” button required by the existing product flow, and real long order numbers make cards slightly denser than the generated sample.
- P3 accepted variation: the actual status list contains more states than the five shown in the concept, so the status row remains horizontally scrollable.

## Implementation checklist

- [x] Selected option 2 hierarchy implemented.
- [x] Real API data loaded after fixing undefined GET filters.
- [x] Local icon assets verified in WeChat Developer Tools.
- [x] Floating navigation and safe-area spacing retained.
- [x] Loading, recoverable error, empty and pagination states retained.
- [x] Side-by-side source/implementation evidence saved.

## Latest adjustment awaiting owner review

- Removed the `门店订单` eyebrow from the order-management header.
- Changed the three-column order summary into a four-corner card with a `-24rpx` overlap into the navy header, restoring the selected concept's curved transition.
- Automated presentation contracts pass, but no new runtime screenshot or side-by-side comparison was captured because the owner explicitly asked Codex not to control the local computer for visual inspection.

## Profile option 3 implementation awaiting owner visual review

- Selected visual truth: `C:\Users\k\.codex\generated_images\019fa442-921b-77e3-9dc4-8c3354447a37\exec-9be5938a-21cc-4fcc-9b9d-1970ebaab3fc.png`.
- Implemented the selected deep-navy rounded security header, oversized `我的` title, shield subtitle, overlapping employee identity card, bound-WeChat badge, grouped account rows, blue security notice, outlined binding-management action, quiet logout action, and the existing floating five-item dock.
- Preserved the real employee session, OWNER-only staff-management entry, account navigation, duplicate-safe WeChat unbind flow, recoverable error state, logout flow, and role display.
- Added local Lucide Static 0.468.0 `shield-check` and `info` SVG assets with ISC license comments; no emoji, CSS-drawn icons, remote icon fonts, gradients, mock sessions, or new routes were introduced.
- Automated evidence: focused profile/presentation suite 12/12 PASS; merchant-mini full suite 118/118 PASS; TypeScript `tsc --noEmit` PASS; `git diff --check` exit 0.
- Runtime visual comparison is intentionally not recorded: the owner explicitly asked Codex not to control the local computer or Developer Tools. The implementation therefore still needs the owner's visual inspection at the real mini-program viewport before fidelity can be marked complete.

## Profile overlap fix from owner screenshot

- Runtime evidence: `C:\Users\k\AppData\Local\Temp\codex-clipboard-57a5f452-0b0c-4610-a3e2-1d7d6956ab33.png` showed the navy positioned header painting above the non-positioned identity card and clipping the top of `cashier1`.
- Root cause: unlike the working order-summary overlap pattern, `.profile-identity-card` had a negative margin but no positioned stacking layer.
- Fix: added `position: relative` and `z-index: 1` to the identity card, with a regression contract that requires the overlap layer.
- Automated evidence: focused profile/presentation suite 12/12 PASS; merchant-mini full suite 118/118 PASS; TypeScript `tsc --noEmit` PASS; `git diff --check` exit 0.
- Owner visual confirmation after refresh is still required because Codex did not control Developer Tools.

## Account and WeChat security-content relocation

- Removed the security notice, unbind action, and unbind error state from the profile overview.
- Added a registered `account-wechat` child page containing employee identity, current binding status, the security notice, recoverable unbind feedback, and the existing duplicate-safe binding-management flow.
- Changed the account shortcut to native child-page navigation so Back returns to the profile overview instead of leaving the profile flow.
- Automated evidence: focused navigation/profile/presentation suite 25/25 PASS; merchant-mini full suite 122/122 PASS; TypeScript `tsc --noEmit` PASS; `git diff --check` exit 0.
- Runtime visual confirmation remains with the owner because Codex did not control Developer Tools.

final result: blocked
