# 商家端工作台整体 UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将商家小程序工作台实现为已确认的深蓝运营工作台，并把五项底栏统一改成带凸起核销按钮的悬浮胶囊导航。

**Architecture:** 保留现有 dashboard、订单与会话数据接口，只调整工作台页面的展示数据、页面结构和样式；共享 `app-tab-bar` 负责全局悬浮导航。商品管理和公告发布仍指向现有不可用说明页，避免添加未经确认的业务接口。

**Tech Stack:** 微信原生小程序、TypeScript、WXML/WXSS、TDesign Miniprogram、Vitest。

## Global Constraints

- 主色固定使用现有 `--primary-600: #082F6B`，不引入新的主题色体系。
- 底栏保留五项顺序：工作台、订单、核销、消息、我的。
- 核销为中央凸起的 48px 深蓝圆形扫码按钮，所有点击目标不小于 44px。
- 悬浮底栏左右留白 16px，底部留白 12px 并兼容 `env(safe-area-inset-bottom)`。
- 不新增后端接口；未实现的商品管理、公告发布继续进入现有功能说明页。
- 不修改用户已有的 `merchant-mini/project.config.json` 和 `merchant-mini/project.private.config.json`。

---

### Task 1: 工作台展示结构

**Files:**
- Modify: `merchant-mini/tests/workbench.spec.ts`
- Modify: `merchant-mini/miniprogram/pages/workbench/index.ts`
- Modify: `merchant-mini/miniprogram/pages/workbench/index.wxml`
- Modify: `merchant-mini/miniprogram/pages/workbench/index.wxss`
- Modify: `merchant-mini/miniprogram/pages/workbench/index.json`

**Interfaces:**
- Consumes: `MerchantDashboardSummary`、`summarizeActiveOrders`、`buildOrderDetailUrl`。
- Produces: `completedCount`、`roleLabel`、`onShortcutTap`、`onAllOrdersTap`，以及自定义工作台头部、优先处理、快捷功能、今日概览、最近订单五个视觉区域。

- [ ] **Step 1: Write the failing test**

```ts
test('renders the approved operations hierarchy and custom header', () => {
  expect(config.navigationStyle).toBe('custom')
  expect(markup).toContain('优先处理')
  expect(markup).toContain('扫码核销')
  expect(markup).toContain('商品管理')
  expect(markup).toContain('发布公告')
  expect(markup).toContain('今日概览')
  expect(markup).toContain('全部订单')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/workbench.spec.ts`

Expected: FAIL because the custom navigation and approved hierarchy are absent.

- [ ] **Step 3: Write minimal implementation**

Add the approved WXML regions; derive `roleLabel` and `completedCount` when loading the current session and summary; route queue cards and quick actions through existing native pages; implement the exact navy/white card hierarchy in WXSS.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run tests/workbench.spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add merchant-mini/tests/workbench.spec.ts merchant-mini/miniprogram/pages/workbench
git commit -m "feat: redesign merchant workbench"
```

### Task 2: 悬浮底栏与凸起核销入口

**Files:**
- Modify: `merchant-mini/tests/navigation.spec.ts`
- Modify: `merchant-mini/miniprogram/components/app-tab-bar/index.wxml`
- Modify: `merchant-mini/miniprogram/components/app-tab-bar/index.wxss`

**Interfaces:**
- Consumes: `NAV_ITEMS` and existing tab routing behavior.
- Produces: `.app-tab-bar` floating dock, `.tab-item--verification`, `.tab-icon-shell`, and active top indicator.

- [ ] **Step 1: Write the failing test**

```ts
test('renders a floating dock with an elevated verification action', () => {
  expect(markup).toContain("item.id === 'verification'")
  expect(styles).toMatch(/left:\s*16px/)
  expect(styles).toMatch(/right:\s*16px/)
  expect(styles).toMatch(/border-radius:\s*24px/)
  expect(styles).toMatch(/\.tab-item--verification[\s\S]*transform:/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/navigation.spec.ts`

Expected: FAIL because the current bar is edge-to-edge and has no special verification action.

- [ ] **Step 3: Write minimal implementation**

Add the verification modifier class and icon shell in WXML; update WXSS to a white floating pill with 16px margins, safe-area bottom offset, shadow, active top indicator, and a 48px elevated navy verification circle.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run tests/navigation.spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add merchant-mini/tests/navigation.spec.ts merchant-mini/miniprogram/components/app-tab-bar
git commit -m "feat: float merchant primary navigation"
```

### Task 3: 全量验证与视觉 QA

**Files:**
- Create: `design-qa.md`
- Modify only if QA identifies an actionable P0/P1/P2 mismatch: the files listed in Task 1 or Task 2.

**Interfaces:**
- Consumes: source visual `exec-3221c7d5-7a31-491b-8f21-e6aca399bd86.png` and WeChat DevTools workbench capture.
- Produces: a passing `design-qa.md` containing source/capture paths, viewport, comparison history, required fidelity surfaces, and `final result: passed`.

- [ ] **Step 1: Run automated verification**

```bash
cd merchant-mini
npm test -- --run
npm run typecheck
```

Expected: all tests and typecheck PASS.

- [ ] **Step 2: Capture the implementation**

Open `merchant-mini` in 微信开发者工具, compile the authenticated workbench state, and save a viewport screenshot matching the selected reference.

- [ ] **Step 3: Compare and fix**

Open the reference and implementation screenshot together. Fix every P0/P1/P2 mismatch in typography, spacing, colors, icon/image fidelity, copy, clipping, and safe-area behavior, then recapture.

- [ ] **Step 4: Save the passing QA report**

Create `design-qa.md` with the evidence and exact final line:

```markdown
final result: passed
```

- [ ] **Step 5: Commit**

```bash
git add design-qa.md merchant-mini/tests merchant-mini/miniprogram
git commit -m "feat: refresh merchant mini program workbench UI"
```
