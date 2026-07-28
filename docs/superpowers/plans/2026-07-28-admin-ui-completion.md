# 管理后台 UI 完整化实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在保留现有真实接口的前提下，将管理后台八个页面补齐为统一酒红视觉、状态完备、响应式且可验收的高保真前端。

**Architecture:** 以 `tokens.css` 作为唯一视觉变量源，提取图标、页面标题、状态面板、筛选/分页和应用壳层组件。业务页面只负责真实数据请求和业务动作，并用统一组件呈现加载、空、错误、无权限、禁用和成功反馈。

**Tech Stack:** Vue 3、TypeScript、Element Plus、Vue Router、Pinia、Vitest、Vue Test Utils、Vite。

## Global Constraints

- 仅修改 `admin/` 与必要 UI 文档/测试。
- 不修改 server、mini、数据库或接口契约，不新增后端依赖。
- 品牌主色固定为深绛红 `#8E2F3F`，状态色不能与品牌色混用。
- 不使用 emoji 作为正式图标；所有图标使用同一套内联 SVG 描边语言。
- 桌面端信息密度优先，同时覆盖 375、768、1024、1440px，无页面级横向溢出。
- 所有真实业务变更保留确认、加载锁定、成功或可恢复错误反馈。

---

### Task 1: 公共状态与权限体验

**Files:**
- Create: `admin/src/components/AppIcon.vue`
- Create: `admin/src/components/UiStatePanel.vue`
- Create: `admin/src/views/ForbiddenView.vue`
- Modify: `admin/src/router/index.ts`
- Test: `admin/tests/AdminUiSystem.spec.ts`
- Test: `admin/tests/RouterAccess.spec.ts`

**Interfaces:**
- `UiStatePanel` consumes `kind`, `title`, `description`, `actionLabel` and emits `action`.
- `/forbidden` renders a recoverable 403 page; owner-only route guards redirect cashiers there.

- [ ] **Step 1: Write failing behavior tests**

```ts
it('renders a recoverable empty state', () => {
  const wrapper = mount(UiStatePanel, {
    props: { kind: 'empty', title: '暂无订单', actionLabel: '刷新' },
  })
  expect(wrapper.get('[role="status"]').text()).toContain('暂无订单')
  wrapper.get('button').trigger('click')
  expect(wrapper.emitted('action')).toHaveLength(1)
})

it('sends cashier direct navigation to the explicit forbidden page', async () => {
  await router.push('/products')
  expect(router.currentRoute.value.path).toBe('/forbidden')
})
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- --run tests/AdminUiSystem.spec.ts tests/RouterAccess.spec.ts`
Expected: FAIL because shared state and forbidden page do not exist.

- [ ] **Step 3: Implement components and route**

Implement semantic `role=status/alert`, accessible SVG labels, and `/forbidden` with a return-to-orders action.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- --run tests/AdminUiSystem.spec.ts tests/RouterAccess.spec.ts`
Expected: PASS.

### Task 2: 酒红应用壳层与响应式基础

**Files:**
- Modify: `admin/src/layouts/AdminLayout.vue`
- Modify: `admin/src/styles/tokens.css`
- Modify: `admin/src/router/index.ts`
- Test: `admin/tests/AdminUiSystem.spec.ts`

**Interfaces:**
- `AdminLayout` derives active title from route metadata, renders role-aware navigation, account context, mobile drawer and skip link.
- Every list page uses `.data-region`, `.filter-panel`, `.pagination-bar`, and `.responsive-table`.

- [ ] **Step 1: Add failing shell tests**

Test role-aware nav labels, top-bar account context, accessible mobile menu, and order-first default route.

- [ ] **Step 2: Run tests and verify expected failure**

Run: `npm test -- --run tests/AdminUiSystem.spec.ts`

- [ ] **Step 3: Implement shell and global component styles**

Add semantic tokens, focus-visible rings, button states, skeletons, data cards, dialog/drawer responsiveness and reduced-motion handling.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- --run tests/AdminUiSystem.spec.ts`

### Task 3: 登录、商品、分类与库存页面

**Files:**
- Modify: `admin/src/views/LoginView.vue`
- Modify: `admin/src/views/catalog/ProductView.vue`
- Modify: `admin/src/views/catalog/CategoryView.vue`
- Modify: `admin/src/views/inventory/InventoryView.vue`
- Modify: related existing tests under `admin/tests/`

**Interfaces:**
- List requests remain the existing API functions.
- Each page owns `loading`, `loadError`, paging/filter state and passes them to shared state UI.

- [ ] **Step 1: Add failing tests for password visibility, empty/error/retry, validation and confirmation**
- [ ] **Step 2: Run the four focused view test files and verify failures**
- [ ] **Step 3: Implement filters, pagination, responsive data regions, dialogs, confirmation and feedback**
- [ ] **Step 4: Re-run focused tests and verify pass**

### Task 4: 订单列表与详情

**Files:**
- Modify: `admin/src/views/orders/OrderListView.vue`
- Modify: `admin/src/views/orders/OrderDetailView.vue`
- Modify: `admin/tests/OrderWorkflow.spec.ts`

**Interfaces:**
- Filters map to existing `AdminOrderQuery`.
- Order mutation functions and server-confirmed reload behavior remain unchanged.

- [ ] **Step 1: Add failing tests for status tabs, reset, pagination, detail error/retry and mutation confirmation**
- [ ] **Step 2: Run order tests and verify expected failures**
- [ ] **Step 3: Implement dense list, summary counts, filter URL state, responsive detail columns, timeline and action dialog**
- [ ] **Step 4: Re-run order tests and verify pass**

### Task 5: 员工账号与操作审计

**Files:**
- Modify: `admin/src/views/staff/StaffView.vue`
- Modify: `admin/src/views/audit/AuditLogView.vue`
- Modify: `admin/tests/StaffView.spec.ts`
- Modify: `admin/tests/AuditLogView.spec.ts`

**Interfaces:**
- Staff and audit API contracts stay unchanged.
- Dangerous staff operations continue to require confirmation.

- [ ] **Step 1: Add failing tests for filters, empty/error/retry, password helper/visibility and paging**
- [ ] **Step 2: Run focused tests and verify failures**
- [ ] **Step 3: Implement complete state and interaction UI**
- [ ] **Step 4: Re-run focused tests and verify pass**

### Task 6: 全量质量与真实浏览器验收

**Files:**
- Create: `admin/UI-ACCEPTANCE.md`
- Modify: only files needed to fix findings.

**Interfaces:**
- Acceptance document lists page, viewport, state, console result and screenshot path.

- [ ] **Step 1: Run full automated verification**

Run: `npm test -- --run && npm run lint && npm run build && npm run format`

- [ ] **Step 2: Start the admin app and inspect every route in a real browser**

Inspect login, product, category, inventory, order list/detail, staff, audit and forbidden states at 1440px and 375px; verify no page-level overflow or fixed-element overlap.

- [ ] **Step 3: Check browser console and capture acceptance screenshots**

Record console errors/warnings and screenshots in `admin/UI-ACCEPTANCE.md`.

- [ ] **Step 4: Fix findings and rerun the full verification command**

- [ ] **Step 5: Commit**

```bash
git add admin docs/superpowers/plans/2026-07-28-admin-ui-completion.md
git commit -m "feat(admin): complete burgundy management UI"
```

