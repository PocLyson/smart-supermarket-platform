# 商家小程序本地与真机测试指南

本指南覆盖 Phase 1 商家小程序的导入、构建、登录绑定、角色验证、订单处理与取货核销。它不替代 [试运营验收单](trial-acceptance.md)：命令行自动检查可以标记为 `PASS`，但真实 AppID、微信开发者工具和真机步骤没有实际证据时只能标记为 `PENDING` 或 `BLOCKED`。

## 1. 前置条件与状态定义

准备 Docker Desktop、JDK 17、Node.js/npm 和微信开发者工具。真机验收还需要：

- 已注册且属于商家小程序的真实 AppID；
- 已备案、证书有效并已配置为微信 `request` 合法域名的 HTTPS API；
- 至少一台真实手机和获准使用该小程序的微信账号；
- 预先在管理后台创建的老板、收银员和停用员工测试账号。仓库不提供共享明文密码。

验收记录只使用以下状态：

- `PASS`：本次实际执行且证据符合预期；
- `FAIL`：本次实际执行但结果不符合预期；
- `PENDING`：尚未执行；
- `BLOCKED`：缺少 AppID、设备、平台权限或可访问环境，暂时无法执行。

不得用自动测试 `PASS` 推导微信开发者工具或真机 `PASS`。

## 2. 安装依赖并构建 npm

在仓库根目录执行：

```powershell
npm --prefix merchant-mini ci
npm --prefix merchant-mini test -- --run
npm --prefix merchant-mini run typecheck
```

打开微信开发者工具，选择“导入项目”，项目目录选择仓库下的 `merchant-mini/`。导入后执行“工具 → 构建 npm”，确认 `tdesign-miniprogram` 被构建到小程序 npm 输出目录且编译面板没有错误。更换依赖或重新执行 `npm ci` 后应再次构建 npm。

`merchant-mini/project.config.json` 已启用 TypeScript 编译插件并固定基础库 `3.17.0`；真机记录必须填写本次开发者工具实际使用的基础库版本，不能仅照抄仓库配置。

## 3. 启动本地依赖与服务端

先在仓库根目录启动依赖：

```powershell
docker compose up -d
```

再打开独立 PowerShell 窗口，执行 brief 约定的本地模拟启动命令：

```powershell
$env:MERCHANT_WECHAT_LOCAL_MOCK_ENABLED = "true"
$env:MERCHANT_WECHAT_LOCAL_MOCK_OPENID = "local-dev-staff"
cd server
.\mvnw.cmd spring-boot:run
```

本地模拟只替代服务端用登录临时凭证换取 openid 的步骤；小程序仍会调用 `wx.login`，员工账号、密码、绑定、角色、会话和订单接口仍使用真实本地数据库及 Redis。

商家微信运行时键如下：

| 环境变量 | 本地模拟 | 真实体验/生产 |
|---|---|---|
| `MERCHANT_WECHAT_APP_ID` | 默认 `touristappid` 即可 | 真实商家 AppID，由服务端安全环境注入 |
| `MERCHANT_WECHAT_APP_SECRET` | 默认本地占位值即可 | 必填，只能在服务端安全环境保存 |
| `MERCHANT_WECHAT_LOCAL_MOCK_ENABLED` | `true` | 必须为 `false` |
| `MERCHANT_WECHAT_LOCAL_MOCK_OPENID` | 每个测试员工使用不同的本地值 | 不使用，由微信登录结果决定 |

本地模拟绝不能用于体验版、生产或真机验收。退出本地联调 PowerShell 后环境变量随进程结束；若当前窗口还要用于其他环境，应显式移除：

```powershell
Remove-Item Env:MERCHANT_WECHAT_LOCAL_MOCK_ENABLED -ErrorAction SilentlyContinue
Remove-Item Env:MERCHANT_WECHAT_LOCAL_MOCK_OPENID -ErrorAction SilentlyContinue
```

## 4. 配置 API 地址

`merchant-mini/miniprogram/config/env.ts` 按微信环境选择地址：

| 微信环境 | 当前地址 | 用途 |
|---|---|---|
| `develop` | `http://localhost:8080` | 本机开发者工具联调 |
| `trial` | `https://trial-api.example.invalid` | 占位，必须在体验版前替换 |
| `release` | `https://api.example.invalid` | 占位，必须在正式版前替换 |

仅开发者工具本地联调时，可在“详情 → 本地设置”中临时关闭合法域名校验，以访问 `http://localhost:8080`。不得把这个选项当作体验版或真机解决方案。

手机上的 `localhost` 指向手机自身，不能访问电脑服务端。真机必须使用手机可访问、证书有效并已加入微信合法域名的 HTTPS 地址；`trial`/`release` 仍为 `.invalid` 时应用会主动阻止请求。部署与微信域名流程见 [域名、备案与微信体验版操作手册](domain-and-wechat-trial.md)。

## 5. 真实 AppID 只保留在本地

受版本控制的 `merchant-mini/project.config.json` 必须保持：

```json
"appid": "touristappid"
```

取得真实商家 AppID 后，在微信开发者工具的导入/项目详情中为当前本地项目选择它。若开发者工具把选择写回 `merchant-mini/project.config.json`，该变更仍只用于本机，提交前必须手工恢复为 `touristappid`。每次提交前检查：

```powershell
git diff -- merchant-mini/project.config.json
git grep -n "<真实商家AppID>" -- .
```

第一条命令应无 AppID 差异，第二条命令应无输出。不要在聊天、截图文件名或验收表中记录完整 AppID。AppSecret 不是小程序配置项，绝不能放入 `merchant-mini/`；应由服务端部署负责人通过不会回显或进入命令历史的安全方式注入 `MERCHANT_WECHAT_APP_SECRET`。

## 6. 准备账号并验证登录绑定

先在管理后台准备三个测试账号：一个 `OWNER`、一个 `CASHIER`、一个之后会被停用的员工。使用各自的一次性密码完成测试，结束后轮换或删除测试凭据。

首次使用某个微信身份时：

1. 打开商家小程序，自动微信登录应提示“当前微信尚未绑定员工账号”。
2. 输入该员工账号和密码，勾选“确认绑定当前微信”。
3. 提交后进入“我的”，核对用户名和角色。
4. 退出后重新进入，确认已绑定身份可以直接微信登录，不再次要求密码。

一个员工账号只能绑定一个微信身份，同一 AppID 下的一个 openid 也只能绑定一个员工账号。做本地模拟角色切换时，先退出当前账号，为下一个员工换一个唯一值并重启服务端，例如：

```powershell
$env:MERCHANT_WECHAT_LOCAL_MOCK_OPENID = "local-owner"
# 启动服务端并完成老板绑定；停止服务端后再使用另一个值
$env:MERCHANT_WECHAT_LOCAL_MOCK_OPENID = "local-cashier"
```

角色预期：

- 老板和收银员都可以查看工作台、处理订单和核销；
- 只有老板可以在允许状态取消订单，并看到老板专属的员工管理入口；
- 收银员不得出现取消订单操作；
- 已绑定员工被管理后台停用后，原会话应失效，重新登录不得进入工作台。出于防枚举设计，停用员工可能显示为“尚未绑定”或“用户名或密码错误”。

真实 AppID 验收应使用获准的实际微信身份完成同样的首次绑定和再次登录，不能沿用 `MERCHANT_WECHAT_LOCAL_MOCK_ENABLED=true` 的结果。

## 7. 工作台、订单与到店付款路径

从“工作台”进入最新订单，或从底部“订单”按状态、付款状态和关键词筛选订单。使用顾客小程序创建一笔订单后，按以下路径处理：

1. `待接单`：打开订单详情，点击“接单”。
2. `备货中`：点击“标记备货完成”。
3. `待取货`：从订单详情点击“核销取货”，或从底部“核销”输入订单号。
4. 未付款订单：在核销预览选择“现金”或“微信收款码”；该选择只记录实际到店收款方式，不会代替真实收款动作。
5. 输入顾客小程序订单详情显示的取货码，核对脱敏取货人、手机号、商品和金额，再点击“确认核销”，并在二次弹窗中再次确认。
6. 核销成功后，订单状态应为 `COMPLETED`；回到订单详情、顾客订单历史和管理后台交叉核对。

也可以先在订单详情点击“确认已收款”并选择收款方式，再核销已付款订单。未实际收到款项时不得点击确认收款或完成核销。

## 8. Phase 1 六位取货码约束

- 只接受恰好六位十进制数字，例如 `473898`；首尾空白会被去除。
- 手工输入和扫码结果遵循同一规则；二维码内容必须直接是六位数字。
- JSON、URL、带前后缀文本、字母、少于或多于六位的内容都必须拒绝。
- 商家端订单列表和详情不返回正确取货码；正确码只能由顾客在自己的订单详情中提供。
- 错误取货码不得改变付款或订单状态；正确码也只能在 `READY_FOR_PICKUP` 状态核销。
- 连续点击同一确认按钮不得创建重复完成记录；并发员工对同一订单操作时，最多一个动作成功，其余终端应刷新并显示订单状态已变化。

取货码属于履约凭证。证据截图应打码，不能写入聊天、日志、提交信息或公开缺陷单。

## 9. 前台提醒与消息占位

登录且小程序在前台时，商家端每 15 秒轮询一次工作台摘要。第一次轮询只建立基线；之后发现新的 `PENDING_CONFIRMATION` 订单时，会短振动并显示“有新订单待接单”提示。切到后台会停止轮询，回到前台后恢复；它不是推送通知，网络失败时也不保证及时提醒。

底部“消息”当前只显示“客服消息将在后续阶段上线”的占位页，没有聊天、消息列表、订阅消息或后台推送能力。Phase 1 值班人员必须同时查看工作台/订单列表，并采用门店既有的人工兜底提醒方式。

## 10. 已知限制与安全/隐私注意

- Phase 1 只覆盖订单工作台、订单处理、到店付款记录和取货核销；消息与商家端员工管理尚未上线。
- 本地模拟只有固定 openid，不证明真实微信 code2session、AppID、AppSecret、合法域名、TLS 或手机网络可用。
- 开发者工具可访问的本机 HTTP 地址不代表手机可访问；真机只能验收已配置的 HTTPS 环境。
- 不记录或传播员工密码、JWT、AppSecret、微信登录 code、openid、完整 AppID、顾客手机号、取货人姓名或取货码。
- 证据只保留最少必要信息，截图前遮盖通知栏、微信头像昵称和顾客字段；服务端问题用时间与 `X-Request-Id` 关联，不复制令牌或请求体机密。
- 测试结束后退出账号，轮换一次性密码，清理不再需要的测试绑定和测试订单；不要删除需要审计或对账的真实订单。

## 11. 真机验收与证据记录

按 [试运营验收单](trial-acceptance.md) 的“商家小程序 Phase 1 真机门禁”逐项执行。证据文件存入团队受控、非公开的证据库：

```text
<受控证据库>/merchant-mini/<YYYYMMDD-提交短哈希>/
```

验收单只填写证据编号或受控路径，不嵌入真实 AppID、密码、令牌、openid、手机号或取货码。没有微信开发者工具、真实 AppID、手机或平台权限时，把相应项记为 `BLOCKED` 并写明缺少的条件；不要勾选通过。
