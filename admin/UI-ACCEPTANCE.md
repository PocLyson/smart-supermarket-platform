# 鲁能超市李老家分店管理后台 UI 验收记录

- 验收日期：2026-07-28
- 浏览器：Codex 应用内 Chromium
- 桌面视口：1440 × 900
- 窄屏视口：390 × 844
- 视觉基线：`admin-navy-complete`
- 视觉数据：通过与现有 TypeScript API 契约一致的临时本地响应提供；生产代码仍调用原有 `/api/admin/**` 接口。

## 页面覆盖

| 编号 | 页面         | 路径                     | 截图                                         | 页面级横向溢出 | 控制台      |
| ---- | ------------ | ------------------------ | -------------------------------------------- | -------------- | ----------- |
| 01   | 登录（桌面） | `/login`                 | `qa-screenshots/01-login-desktop.png`        | 无             | 无错误/警告 |
| 02   | 商品管理     | `/products`              | `qa-screenshots/02-products-desktop.png`     | 无             | 无错误/警告 |
| 03   | 分类管理     | `/categories`            | `qa-screenshots/03-categories-desktop.png`   | 无             | 无错误/警告 |
| 04   | 线上库存     | `/inventory`             | `qa-screenshots/04-inventory-desktop.png`    | 无             | 无错误/警告 |
| 05   | 订单列表     | `/orders`                | `qa-screenshots/05-orders-desktop.png`       | 无             | 无错误/警告 |
| 06   | 订单详情     | `/orders/LN202607280018` | `qa-screenshots/06-order-detail-desktop.png` | 无             | 无错误/警告 |
| 07   | 员工账号     | `/staff`                 | `qa-screenshots/07-staff-desktop.png`        | 无             | 无错误/警告 |
| 08   | 操作审计     | `/audit`                 | `qa-screenshots/08-audit-desktop.png`        | 无             | 无错误/警告 |
| 09   | 403 / 无权限 | `/forbidden`             | `qa-screenshots/09-forbidden-desktop.png`    | 无             | 无错误/警告 |

## 弹窗与确认反馈

| 编号 | 状态           | 截图                                              |
| ---- | -------------- | ------------------------------------------------- |
| 10   | 新增商品弹窗   | `qa-screenshots/10-product-editor-dialog.png`     |
| 11   | 新增分类弹窗   | `qa-screenshots/11-category-editor-dialog.png`    |
| 12   | 库存调整弹窗   | `qa-screenshots/12-inventory-adjust-dialog.png`   |
| 13   | 订单接单确认   | `qa-screenshots/13-order-fulfillment-confirm.png` |
| 14   | 新增收银员弹窗 | `qa-screenshots/14-staff-editor-dialog.png`       |

## 窄屏覆盖

| 编号 | 页面     | 截图                                        | 数据呈现             | 页面级横向溢出 |
| ---- | -------- | ------------------------------------------- | -------------------- | -------------- |
| 15   | 登录     | `qa-screenshots/15-login-mobile.png`        | 单列登录卡           | 无             |
| 16   | 商品管理 | `qa-screenshots/16-products-mobile.png`     | 商品卡片             | 无             |
| 17   | 线上库存 | `qa-screenshots/17-inventory-mobile.png`    | 库存卡片             | 无             |
| 18   | 订单列表 | `qa-screenshots/18-orders-mobile.png`       | 订单卡片             | 无             |
| 19   | 订单详情 | `qa-screenshots/19-order-detail-mobile.png` | 商品卡片与纵向信息区 | 无             |
| 20   | 员工账号 | `qa-screenshots/20-staff-mobile.png`        | 员工卡片             | 无             |

## 验收结论

- 侧栏、页头、筛选、表格、卡片、标签、按钮、表单、弹窗和时间线统一使用海军蓝设计语言。
- 正式门店名称统一为“鲁能超市李老家分店”；侧栏使用“鲁能超市 / 李老家分店管理后台”。
- 桌面表格保持舒展行高与数字对齐；390px 窄屏将关键宽表转换为卡片，没有硬压缩表格。
- 商品缩略图覆盖正常图片、加载占位和损坏图片回退状态。
- 加载、空数据、请求错误、无权限、禁用、成功消息、删除/履约确认与分页均由共享状态或页面组件覆盖。
- 逐页测量时 `documentElement.scrollWidth` 不大于 `clientWidth`；订单状态标签只在自身容器内横向滚动。
- 浏览器控制台最终检查为 0 条错误、0 条警告。

## 遗留项

- 本次未修改接口、服务端、数据库或小程序；真实环境的网络延迟与大数据量分页表现需在联调环境继续观察。
- 浏览器视觉验收使用临时本地契约响应，未执行会改变真实业务数据的新增、库存调整、履约或员工管理提交。
