# Mini 首页视觉 QA

## Comparison target

- Source visual truth: `C:\Users\k\Documents\智慧超市平台\协助交接\UI\智慧超市小程序首页-深绛红效果图.png`
- Implementation screenshot: `C:\Users\k\.codex\visualizations\2026\07\27\019fa457-8cd7-7bb3-90aa-99b41d395f18\mini-home-implementation.png`
- Side-by-side evidence: `C:\Users\k\.codex\visualizations\2026\07\27\019fa457-8cd7-7bb3-90aa-99b41d395f18\mini-home-visual-comparison.png`
- State: 微信开发者工具中的首页，9 个分类、8 个商品的运行时 mock 数据，深绛红主题，首页底栏选中。
- CSS viewport: 微信开发者工具模拟器 `390 × 852` CSS px。
- Source pixels: `852 × 1858`; implementation capture pixels: `363 × 789`.
- Density normalization: source was downsampled to `363 × 789`; the implementation was cropped from the scaled simulator at the same aspect ratio and compared at equal pixel dimensions.

## Findings

No actionable P0/P1/P2 differences remain.

- Fonts and typography: both use the system Chinese sans-serif stack with the same strong white header hierarchy, dark section heading, burgundy price emphasis, and compact category labels. The implementation keeps slightly smaller dynamic-product metadata so API-provided names and units remain readable.
- Spacing and layout rhythm: header, search, hero, two-row five-column category area, recommendation grid, and fixed four-item tab bar preserve the source order and visual rhythm. The implementation intentionally renders one API product per card instead of the source's marketing section cards, because the frozen MVP plan requires tappable product-summary cards.
- Colors and tokens: the implementation maps primary `#8E2F3F`, hover `#762536`, pressed `#5E1D2B`, selected `#F5E7EA`, and page `#F8F5F1` through centralized WXSS tokens and TDesign variables.
- Image quality: hero and category imagery are real raster assets with matching warm grocery subjects and crops. Navigation and location icons use official TDesign icon assets rather than text glyphs, CSS drawings, or mixed icon libraries.
- Copy and content: the confirmed store title, search prompt, hero copy, category labels, recommendation heading, and 首页/分类/购物车/订单 navigation are present. The extra “全部商品” entry is intentional and preserves the MVP category-filter contract.
- Accessibility and interaction: custom category entries expose `role="button"` and `aria-label`; the visible controls meet the existing touch-target tokens. The TDesign 分类 tab was exercised and scrolled to the category section while keeping 首页 selected.

## Comparison history

1. Initial normalized comparison found a P2 horizontal overflow in the five-column category area: the rightmost category was clipped.
   - Root cause evidence: 微信开发者工具 WXML inspector showed `.category-slot` at `73.2 × 79`, while its native `button.category-item` child was `184 × 79` because the injected `wx-button:not(.size-mini)` rule overrode the intended width.
   - Fix: replaced native category buttons with custom `view` controls carrying `role="button"` and `aria-label`; retained the 20% flex slots.
2. Post-fix comparison shows two complete rows of five evenly sized category entries, no clipping, stable hero/product grids, and an unobstructed fixed tab bar.
3. Post-review runtime check injected 11 enabled categories. All entries rendered across additional rows, overflow entries received a cyclic local-image fallback, and the TDesign tab bar placeholder kept the end of the list clear of the fixed navigation.

## Focused region evidence

A separate enlarged crop was not needed: the equal-size side-by-side comparison keeps the header/search, hero crop, all category labels, recommendation heading, product imagery, and all four tab labels readable. The WXML inspector was used separately to verify the category slot and control dimensions during the overflow fix.

## Primary interactions and runtime checks

- 微信开发者工具 npm build completed successfully for TDesign MiniProgram.
- Home compiled after the final layout change.
- TDesign search, button, icon, and tab bar rendered in the simulator.
- 分类 tab scroll interaction passed.
- More than 9 enabled categories remained visible and tappable in an additional row.
- Console was cleared after validation; no current application error remained. Backend-unavailable and tourist-mode messages observed earlier were environmental and were not used as passing evidence.

## Follow-up polish

- The source groups products into merchandising sections, while the MVP contract renders API product-summary cards. A future merchandising API could support those grouped cards without hard-coding presentation-only product relationships.

final result: passed
