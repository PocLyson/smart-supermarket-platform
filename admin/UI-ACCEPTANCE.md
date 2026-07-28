# 管理后台 UI 浏览器验收记录

- 验收日期：2026-07-28
- 浏览器：Codex 应用内 Chromium
- 桌面视口：1440 × 900
- 窄屏视口：375 × 812
- 视觉数据：与现有 TypeScript API 契约一致的只读本地 Mock；真实 API 请求代码未替换。

## 页面覆盖

| 页面     | 路径                   | 桌面截图                                  | 窄屏截图                                 | 页面级横向溢出 | 控制台      |
| -------- | ---------------------- | ----------------------------------------- | ---------------------------------------- | -------------- | ----------- |
| 登录     | `/login`               | `qa-screenshots/login-desktop.png`        | `qa-screenshots/login-mobile.png`        | 无             | 无错误/警告 |
| 订单列表 | `/orders`              | `qa-screenshots/orders-desktop.png`       | `qa-screenshots/orders-mobile.png`       | 无             | 无错误/警告 |
| 订单详情 | `/orders/202607280001` | `qa-screenshots/order-detail-desktop.png` | `qa-screenshots/order-detail-mobile.png` | 无             | 无错误/警告 |
| 商品管理 | `/products`            | `qa-screenshots/products-desktop.png`     | `qa-screenshots/products-mobile.png`     | 无             | 无错误/警告 |
| 分类管理 | `/categories`          | `qa-screenshots/categories-desktop.png`   | `qa-screenshots/categories-mobile.png`   | 无             | 无错误/警告 |
| 线上库存 | `/inventory`           | `qa-screenshots/inventory-desktop.png`    | `qa-screenshots/inventory-mobile.png`    | 无             | 无错误/警告 |
| 员工账号 | `/staff`               | `qa-screenshots/staff-desktop.png`        | `qa-screenshots/staff-mobile.png`        | 无             | 无错误/警告 |
| 操作审计 | `/audit`               | `qa-screenshots/audit-desktop.png`        | `qa-screenshots/audit-mobile.png`        | 无             | 无错误/警告 |
| 无权限   | `/forbidden`           | `qa-screenshots/forbidden-desktop.png`    | `qa-screenshots/forbidden-mobile.png`    | 无             | 无错误/警告 |

## 交互检查

- 移动端侧栏默认完全隐藏，打开后宽 304px，遮罩正常显示；关闭按钮可用。
- 键盘跳转链接、可见字段标签、密码显隐按钮、状态文字与错误 `role="alert"` 均可从 DOM 读取。
- 桌面和窄屏所有页面的 `documentElement.scrollWidth` 均等于 `clientWidth`；宽表只在自身数据区域滚动。
- 筛选栏在窄屏改为单列，关键词字段不再继承桌面 flex 高度。
- 登录、订单列表、订单详情、商品、分类、库存、员工、审计和 403 均完成真实浏览器截图。

## 数据与安全说明

真实后端在验收环境中可达，但仓库不保存可复用老板密码。逐页视觉验收使用临时 Service Worker 提供只读展示数据；验收结束后已注销 Worker、清理本地会话并删除临时文件。页面生产代码继续调用原有 `/api/admin/**` 接口。
