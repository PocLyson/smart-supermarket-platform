# 智慧超市 MVP API

## 通用约定

- 基础路径：`/api`；JSON 使用 UTF-8。
- 认证：除公开接口外，使用 `Authorization: Bearer <JWT>`。
- 角色：`OWNER`（老板）、`CASHIER`（收银员）、`CUSTOMER`（顾客）。
- 每个 JSON 响应和 `X-Request-Id` 响应头都带请求 ID；客户端可发送合法的 `X-Request-Id` 便于追踪。
- 金额一律为人民币“分”，库存一律为整数。

统一响应：

```json
{
  "code": "OK",
  "message": "成功",
  "requestId": "c7b1...",
  "data": {}
}
```

失败时 `data` 为 `null`。分页订单使用 Spring Page 字段 `content`、`totalElements`、`number`、`size`；商品和审计分页使用 `items`、`total`、`page`、`size`。

## 公开接口

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/actuator/health` | 服务健康检查 |
| POST | `/api/admin/auth/login` | 员工登录；每 IP 每 10 分钟 10 次 |
| POST | `/api/mini/auth/wechat` | 微信 `code` 登录；每 IP 每 10 分钟 30 次 |
| GET | `/api/mini/categories` | 已启用分类 |
| GET | `/api/mini/products?categoryId=&keyword=&page=0&size=20` | 已上架商品 |
| GET | `/api/mini/products/{id}` | 已上架商品详情 |
| GET | `/files/{generatedName}` | 商品图片，仅接受服务端生成的 UUID 文件名 |

小程序商品列表和详情响应包含整数 `availableStock`。客户端在该值小于等于 `0` 时必须显示“暂时缺货”，并禁止加入购物车；创建订单时服务端仍会再次校验实时库存。顾客端商品列表全局按有库存商品优先、无库存商品最后排序，同一库存分组内按商品编号倒序；后台商品列表顺序不受影响。

员工登录请求：

```json
{"username":"owner","password":"输入的密码"}
```

返回 `{"accessToken":"...","role":"OWNER"}`。微信登录请求为 `{"code":"wx.login 返回值"}`，返回 `accessToken` 和 `profileComplete`；微信 `session_key` 永不返回客户端。

## 顾客接口

均要求 `CUSTOMER`。

| 方法 | 路径 | 请求/说明 |
|---|---|---|
| GET | `/api/mini/profile` | 当前顾客资料 |
| PUT | `/api/mini/profile` | `nickname`、`avatarUrl`、`pickupName`、`phone` |
| POST | `/api/mini/orders` | 创建订单；必须带 `Idempotency-Key` |
| GET | `/api/mini/orders?page=0&size=20` | 本人订单列表 |
| GET | `/api/mini/orders/{orderNo}` | 本人订单详情 |
| POST | `/api/mini/orders/{orderNo}/cancel` | 仅待确认状态可取消 |
| DELETE | `/api/mini/orders/{orderNo}` | 仅已完成或已取消订单；只从该顾客列表隐藏，业务记录保留 |

订单创建、列表和详情响应均包含六位数字 `pickupCode`，仅供顾客在小程序订单详情中出示。后台订单响应不返回完整取货码；员工完成订单时提交顾客出示的取货码，由服务端核验。

创建订单：

```http
Idempotency-Key: 4c2d52ad-...
Content-Type: application/json

{
  "pickupName": "李先生",
  "phone": "13800138000",
  "items": [
    {"productId": 10, "quantity": 2}
  ]
}
```

同一顾客重复提交同一个 `Idempotency-Key` 返回首次创建的订单，不重复扣库存；键最长 128 字符。商品价格、名称和单位均以服务端下单时快照为准。每位顾客每分钟最多尝试创建 10 次订单。

## 老板商品、库存与图片接口

均要求 `OWNER`。

| 方法 | 路径 | 请求/说明 |
|---|---|---|
| GET | `/api/admin/categories` | 全部分类 |
| POST | `/api/admin/categories` | `name`、`sortOrder`、`enabled` |
| PUT | `/api/admin/categories/{id}` | 更新分类 |
| GET | `/api/admin/products?categoryId=&keyword=&page=0&size=20` | 后台商品列表 |
| POST | `/api/admin/products` | 创建商品；可传非负整数 `initialStock` 作为初始可售库存，缺省为0 |
| PUT | `/api/admin/products/{id}` | 更新商品 |
| PATCH | `/api/admin/products/{id}/shelf` | `{"onShelf":true}` |
| GET | `/api/admin/inventory?categoryId=&stockStatus=` | 库存入口信息；`stockStatus` 可传 `IN_STOCK`、`LOW_STOCK`（1–5）或 `OUT_OF_STOCK` |
| POST | `/api/admin/inventory/{productId}/adjustments` | `{"delta":10,"reason":"首批库存"}` |
| POST | `/api/admin/files/images` | multipart 字段 `file` |

商品写请求：

```json
{
  "categoryId": 1,
  "name": "纯牛奶",
  "priceCent": 590,
  "unit": "盒",
  "coverImageUrl": "/files/生成名.png",
  "description": "商品说明",
  "onShelf": true
}
```

图片仅允许 JPEG、PNG、WebP，单文件最大 5 MiB。服务端会真实解码、返回 `url`、`width`、`height`、`size`，不采用原文件名。

## 后台订单接口

`OWNER` 与 `CASHIER` 均可使用。

| 方法 | 路径 | 请求/说明 |
|---|---|---|
| GET | `/api/admin/orders?status=&paymentStatus=&keyword=&page=0&size=20` | 按状态、付款状态、订单号、取货人或手机号筛选 |
| GET | `/api/admin/orders/{orderNo}` | 订单快照和状态历史，不返回完整取货码 |
| POST | `/api/admin/orders/{orderNo}/accept` | 接单 |
| POST | `/api/admin/orders/{orderNo}/reject` | `{"reason":"拒单原因"}` |
| POST | `/api/admin/orders/{orderNo}/ready` | 标记备货完成 |
| POST | `/api/admin/orders/{orderNo}/pay` | `{"method":"CASH"}` 或 `WECHAT_QR` |
| POST | `/api/admin/orders/{orderNo}/complete` | 已付款且待取货时提交 `{"pickupCode":"123456"}`；取货码核验通过后完成 |
| POST | `/api/admin/orders/{orderNo}/cancel` | `{"reason":"取消原因"}` |
| DELETE | `/api/admin/orders/{orderNo}` | 仅已完成或已取消订单；只从后台列表归档，顾客端不受影响 |

每个成功写操作都会生成状态历史（付款除外）和操作日志。取消与库存返还处于同一数据库事务中。订单删除采用双方独立的可见性标记，不物理删除订单、商品快照、库存流水、状态历史或审计日志。

## 员工与审计接口

均要求 `OWNER`。

| 方法 | 路径 | 请求/说明 |
|---|---|---|
| GET | `/api/admin/staff` | 员工列表，不返回密码哈希 |
| POST | `/api/admin/staff` | `{"username":"cashier1","password":"至少8位"}` |
| PATCH | `/api/admin/staff/{id}/enabled` | `{"enabled":false}` |
| POST | `/api/admin/staff/{id}/reset-password` | `{"password":"新密码"}` |
| GET | `/api/admin/audit-logs?actorId=&action=&objectType=&page=0&size=20` | 审计日志筛选 |

审计条目返回操作人、动作、对象类型、对象 ID、结果摘要、请求 ID 和时间，不返回密码哈希、JWT、微信会话密钥或环境机密。

## 状态与转换

订单状态：

```text
PENDING_CONFIRMATION -> PREPARING -> READY_FOR_PICKUP -> COMPLETED
PENDING_CONFIRMATION | PREPARING | READY_FOR_PICKUP -> CANCELLED
```

- 顾客只能从 `PENDING_CONFIRMATION` 取消。
- `READY_FOR_PICKUP` 只有在付款状态为 `PAID` 后才能完成。
- 付款状态：`UNPAID`、`PAID`。
- 付款方式：`CASH`、`WECHAT_QR`。

## 错误码

| HTTP | code | 含义 |
|---:|---|---|
| 400 | `VALIDATION_ERROR` | 请求字段或业务输入不合法 |
| 400 | `INVALID_IMAGE` | 图片类型、内容、尺寸或大小不合法 |
| 401 | `UNAUTHORIZED` | 未登录或会话失效 |
| 401 | `INVALID_CREDENTIALS` | 员工用户名或密码错误 |
| 401 | `WECHAT_LOGIN_FAILED` | 微信登录交换失败 |
| 403 | `FORBIDDEN` | 角色无权执行 |
| 403 | `ACCOUNT_DISABLED` | 账号已停用 |
| 404 | `NOT_FOUND` | 资源不存在或不属于当前顾客 |
| 409 | `PRODUCT_UNAVAILABLE` | 商品不存在或已下架 |
| 409 | `INSUFFICIENT_STOCK` | 线上库存不足 |
| 409 | `ORDER_STATE_CONFLICT` | 非法或重复状态转换 |
| 429 | `RATE_LIMITED` | 超出敏感接口固定窗口限额 |
| 500 | `INTERNAL_ERROR` | 未预期错误；响应不包含堆栈 |
