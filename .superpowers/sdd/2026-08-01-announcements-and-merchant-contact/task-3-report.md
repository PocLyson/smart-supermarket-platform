# Task 3：后台公告管理报告

## 交付内容

- 新增 `admin/src/api/announcements.ts`，提供公告列表、创建、更新、发布、下线和删除的类型化后台 API。
- 新增 OWNER 专用公告管理页面：状态筛选、表格与移动端卡片、草稿编辑器、标题 `60` / 正文 `2000` 实时计数与提交限制。
- 公告生命周期符合约束：已发布公告只显示“下线”；草稿和已下线公告可以编辑、删除及发布/重新发布；发布、下线、删除均先确认。
- `/announcements` 被加入 `ownerOnlyRoutes` 与路由元数据；导航项仅在 OWNER 侧边栏显示；新增 announcements 图标。

## RED 证据

先新增 `admin/tests/AnnouncementView.spec.ts`，覆盖 API 调用、状态筛选、长度限制、已发布/已下线操作差异、确认删除、收银员路由拒绝和 OWNER 菜单显示。

在页面和 API 尚未创建时执行：

```powershell
cd admin
npm test -- AnnouncementView.spec.ts
```

结果：失败，Vite 无法解析 `@/views/announcements/AnnouncementView.vue`，证明用例因功能缺失而红。

## GREEN 与验证证据

```powershell
cd admin
npm test -- AnnouncementView.spec.ts  # 7 passed
npm test -- --run                     # 14 files, 63 tests passed
npm run build                          # vue-tsc 与 vite build 成功
npm run lint                           # 成功
```

构建期间发现 Element Plus 表格插槽行被推断为 `any`，导致状态映射索引出现 `TS7053`。根因是模板直接使用 `statusLabel[row.status]`；已以类型化 `statusLabelFor` 边界函数收敛，后续构建成功。

## 自审

- [x] API 类型与端点对应后端 `AdminAnnouncementController`。
- [x] CASHIER 直接访问 `/announcements` 被守卫重定向至 `/forbidden`，且不会看到导航。
- [x] PUBLISHED 行不提供编辑或删除；必须先下线。
- [x] OFFLINE 行可编辑、删除和重新发布。
- [x] 发布、下线、删除都有 Element Plus 确认框；取消删除不会请求 API。
- [x] 桌面表格与移动端卡片共用同一数据和状态规则，沿用既有海军蓝后台与 Element Plus 组件。

## 已知事项

`npm run format` 的全仓检查仍会报告任务外既有文件（如 orders、inventory）的格式问题；本任务新增文件已通过目标 Prettier 检查，且未改动这些既有文件。

## Fix round 1：公告分页

**文件：**

- 修改 `admin/src/views/announcements/AnnouncementView.vue`
- 修改 `admin/tests/AnnouncementView.spec.ts`
- 更新本报告

**RED：** 先新增分页用例，使用 `total: 41` 的列表响应，要求页面展示 Element Plus 分页控件、切换至第 2 页请求 `{ page: 1, size: 20 }`，切换为 `DRAFT` 后请求 `{ status: 'DRAFT', page: 0, size: 20 }` 且分页控件回到第 1 页。实现前执行 `npm test -- AnnouncementView.spec.ts` 失败，原因是找不到 `[data-test="announcement-pagination"]`。

**GREEN：** 新增 `currentPage` 状态；加载请求使用零基 `currentPage - 1`；页码变更刷新目标页，状态变更重置到第 1 页再刷新。分页控件位于桌面表格和移动端卡片之后，并在窄屏居中，两个布局共用同一个可操作分页控件与状态。

**验证：**

```powershell
cd admin
npm test -- AnnouncementView.spec.ts  # 8 passed
npm test -- --run                     # 14 files, 64 tests passed
npm run build                          # vue-tsc 与 vite build 成功
```

## Fix round 2：末页收缩回退

**文件：**

- 修改 `admin/src/views/announcements/AnnouncementView.vue`
- 修改 `admin/tests/AnnouncementView.spec.ts`
- 更新本报告

**RED：** 新增末页收缩用例：第 2 页在删除或状态迁移后返回 `items: []`、`total: 20`，要求自动请求第 1 页且总请求数固定为 3。实现前聚焦测试只发生两次请求，停留在空页。另新增正常第 1 页空列表用例，确认只显示空态且不额外请求。

**GREEN：** `load` 在收到空结果且当前不在第 1 页时，计算最后有效页并回退至“上一页与最后有效页中更靠前者”，仅重新请求一次；不递归重试，因此不会形成循环。第 1 页正常空列表不会进入回退分支，继续显示原有空态。

**验证：**

```powershell
cd admin
npm test -- AnnouncementView.spec.ts  # 10 passed
npm test -- --run                     # 14 files, 66 tests passed
npm run build                          # vue-tsc 与 vite build 成功
```
