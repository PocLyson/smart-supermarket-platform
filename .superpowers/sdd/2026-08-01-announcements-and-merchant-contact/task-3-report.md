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
