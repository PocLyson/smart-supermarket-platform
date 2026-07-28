# 鲁能超市李老家分店管理后台海军蓝实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将已批准的 `admin-navy-complete` 视觉稿完整实现到现有 Vue 3 管理后台，同时保持真实 API 契约和业务行为不变。

**Architecture:** 延续现有 Vue 3、Vue Router、Pinia、Element Plus 与 TypeScript 架构。先通过组件测试固定品牌、导航、筛选、表格、弹窗、状态反馈和移动卡片行为，再以全局 token、共享 SVG 图标、桌面表格与窄屏卡片双视图完成视觉实现。

**Tech Stack:** Vue 3.5、TypeScript 5.9、Element Plus 2.11、Pinia 3、Vue Router 4、Vitest 4、Vue Test Utils、Vite 7。

## Global Constraints

- 视觉唯一来源：`C:/Users/k/.codex/visualizations/2026/07/28/019fa75c-d55e-7931-b5c0-246372b86b0c/admin-navy-complete/`。
- 正式门店名称必须为“鲁能超市李老家分店”；侧栏使用“鲁能超市 / 李老家分店管理后台”。
- 主色 `#082F6B`，页面背景 `#F7F9FC`，面板 `#FFFFFF`，成功/库存 `#2E9B62`，价格/错误 `#E5484D`，边框 `#E7ECF3`。
- 不修改 `server/`、`mini/`、数据库或 API 契约，不新增后端依赖。
- 统一细线 SVG 图标，不使用 emoji。
- 桌面保持高效但不拥挤；窄屏使用卡片/抽屉，不硬压缩表格，不产生页面级横向溢出。

---

### Task 1: 品牌、设计 token 与导航外壳

**Files:**

- Modify: `admin/tests/AdminUiSystem.spec.ts`
- Modify: `admin/tests/LoginView.spec.ts`
- Modify: `admin/src/styles/tokens.css`
- Modify: `admin/src/layouts/AdminLayout.vue`
- Modify: `admin/src/views/LoginView.vue`
- Modify: `admin/index.html`

**Interfaces:**

- Consumes: 现有 `useAuthStore()`、路由元信息和 `AppIcon`。
- Produces: 海军蓝语义 token、正式品牌文案、桌面侧栏和窄屏抽屉导航。

- [ ] **Step 1: 写失败测试**

```ts
expect(wrapper.text()).toContain('鲁能超市')
expect(wrapper.text()).toContain('李老家分店管理后台')
expect(wrapper.text()).not.toContain('智慧超市')
expect(wrapper.get('nav').attributes('aria-label')).toBe('后台主菜单')
```

- [ ] **Step 2: 运行测试并确认因旧品牌文案失败**

Run: `npm test -- --run tests/AdminUiSystem.spec.ts tests/LoginView.spec.ts`

Expected: FAIL，页面仍渲染“智慧超市”。

- [ ] **Step 3: 最小实现海军蓝 token 与正式品牌**

将主色阶映射到 `#082F6B`，更新页面/面板/边框/语义色，并替换登录页、侧栏、移动顶栏与 HTML 元信息中的品牌文案。

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test -- --run tests/AdminUiSystem.spec.ts tests/LoginView.spec.ts`

Expected: PASS。

### Task 2: 商品图片、筛选、桌面表格与移动卡片

**Files:**

- Modify: `admin/tests/ProductView.spec.ts`
- Modify: `admin/tests/ProductImageUpload.spec.ts`
- Modify: `admin/src/components/ProductImageUpload.vue`
- Modify: `admin/src/views/catalog/ProductView.vue`
- Modify: `admin/src/views/catalog/CategoryView.vue`

**Interfaces:**

- Consumes: `listProducts`、`listCategories`、商品写入 API。
- Produces: 带真实缩略图、图片失败占位、分页、筛选和移动卡片的商品/分类界面。

- [ ] **Step 1: 写失败测试**

```ts
expect(wrapper.find('[data-test="product-mobile-list"]').exists()).toBe(true)
await wrapper.get('[data-test="product-image-1"]').trigger('error')
expect(wrapper.find('[data-test="product-image-fallback-1"]').exists()).toBe(true)
```

- [ ] **Step 2: 运行并确认移动列表和错误占位缺失**

Run: `npm test -- --run tests/ProductView.spec.ts tests/ProductImageUpload.spec.ts`

Expected: FAIL。

- [ ] **Step 3: 实现双视图和图片恢复状态**

桌面使用放宽行高的数据表格，窄屏渲染商品/分类卡片；图片加载失败后显示带文字说明的 SVG 占位。

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test -- --run tests/ProductView.spec.ts tests/ProductImageUpload.spec.ts`

Expected: PASS。

### Task 3: 库存、订单与履约

**Files:**

- Modify: `admin/tests/InventoryView.spec.ts`
- Modify: `admin/tests/OrderWorkflow.spec.ts`
- Modify: `admin/src/views/inventory/InventoryView.vue`
- Modify: `admin/src/views/orders/OrderListView.vue`
- Modify: `admin/src/views/orders/OrderDetailView.vue`

**Interfaces:**

- Consumes: 现有库存查询/调整与订单状态迁移 API。
- Produces: 库存移动卡片、订单筛选/统计、详情商品卡片和分组履约确认弹窗。

- [ ] **Step 1: 写失败测试**

```ts
expect(wrapper.find('[data-test="inventory-mobile-list"]').exists()).toBe(true)
expect(wrapper.find('[data-test="order-mobile-list"]').exists()).toBe(true)
expect(wrapper.text()).toContain('鲁能超市李老家分店')
```

- [ ] **Step 2: 运行并确认移动卡片和正式门店信息缺失**

Run: `npm test -- --run tests/InventoryView.spec.ts tests/OrderWorkflow.spec.ts`

Expected: FAIL。

- [ ] **Step 3: 实现库存/订单双视图和履约视觉分组**

保留所有 API 调用与状态判断，增加移动卡片、统计摘要、金额数字对齐、完整取货门店和宽松的弹窗分组。

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test -- --run tests/InventoryView.spec.ts tests/OrderWorkflow.spec.ts`

Expected: PASS。

### Task 4: 员工、审计、403 与系统状态

**Files:**

- Modify: `admin/tests/StaffView.spec.ts`
- Modify: `admin/tests/AuditLogView.spec.ts`
- Modify: `admin/tests/AdminUiSystem.spec.ts`
- Modify: `admin/src/views/staff/StaffView.vue`
- Modify: `admin/src/views/audit/AuditLogView.vue`
- Modify: `admin/src/views/ForbiddenView.vue`
- Modify: `admin/src/components/UiStatePanel.vue`

**Interfaces:**

- Consumes: 现有员工和审计 API、路由权限。
- Produces: 员工移动卡片、审计移动记录、明确 403 恢复路径与统一加载/空/错误状态。

- [ ] **Step 1: 写失败测试**

```ts
expect(wrapper.find('[data-test="staff-mobile-list"]').exists()).toBe(true)
expect(wrapper.find('[data-test="audit-mobile-list"]').exists()).toBe(true)
expect(state.classes()).toContain('is-error')
```

- [ ] **Step 2: 运行并确认移动列表和状态样式缺失**

Run: `npm test -- --run tests/StaffView.spec.ts tests/AuditLogView.spec.ts tests/AdminUiSystem.spec.ts`

Expected: FAIL。

- [ ] **Step 3: 实现移动卡片与恢复反馈**

窄屏隐藏宽表格并显示卡片；403 提供返回工作台和权限说明；状态组件继续使用可访问角色和明确操作。

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test -- --run tests/StaffView.spec.ts tests/AuditLogView.spec.ts tests/AdminUiSystem.spec.ts`

Expected: PASS。

### Task 5: 全量验证与真实浏览器验收

**Files:**

- Update: `admin/UI-ACCEPTANCE.md`
- Create/Update: `admin/qa-screenshots/*.png`

**Interfaces:**

- Consumes: 完整管理后台构建。
- Produces: 命令验证记录、桌面/窄屏截图和最终独立分支提交。

- [ ] **Step 1: 运行全量自动验证**

```powershell
npm test -- --run
npx vue-tsc --noEmit
npm run build
npm run lint
npm run format
```

- [ ] **Step 2: 启动本地预览并逐页浏览**

检查 `/login`、`/products`、`/categories`、`/inventory`、`/orders`、订单详情、`/staff`、`/audit`、`/forbidden` 的 1440px 与 390px 视口。

- [ ] **Step 3: 检查控制台和页面级横向溢出**

每页确认 `document.documentElement.scrollWidth === document.documentElement.clientWidth`，并记录控制台错误/警告。

- [ ] **Step 4: 保存截图和验收记录**

截图写入 `admin/qa-screenshots/`，验收结果写入 `admin/UI-ACCEPTANCE.md`。

- [ ] **Step 5: 提交当前独立分支**

```powershell
git add admin
git commit -m "feat(admin): implement navy supermarket UI"
```
