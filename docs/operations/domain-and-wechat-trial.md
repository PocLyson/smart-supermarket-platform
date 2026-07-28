# 域名、备案与微信体验版操作手册

本手册用于把智慧超市从本地环境推进到中国大陆腾讯云轻量应用服务器上的微信体验版。所有命令都使用占位符；不得把真实域名、IP、账号、AppSecret、密码、证书私钥或验证码写入 Git、工单、聊天记录和命令历史。

## 操作边界

以下事项只能由获得相应权限的负责人在外部平台完成，无法通过本地仓库代办：

- 负责人批准预算，以及购买腾讯云轻量应用服务器和域名；
- 域名实名认证、ICP 备案资料提交、视频核验、短信核验和备案结果确认；
- DNS 记录变更、TLS 证书申请或签发；
- 微信公众平台合法域名配置、体验成员管理和体验版选择；
- 在微信开发者工具中使用实际 AppID 上传代码；
- 在服务器安全终端写入 AppSecret 等生产密钥。

本地操作人员可以准备配置、运行检查、部署和记录验收结果，但不得索取或代为保存上述平台的真实密钥。

## 全程停止条件

出现任一情况立即停止部署或上传，不得通过关闭校验、启用本地模拟登录或临时改用不受信任域名绕过：

- ICP 备案尚未审核通过；
- TLS 证书链无效、域名不匹配或证书已过期；
- `production-readiness.mjs` 检查失败；
- 小程序 `trial` 或 `release` 地址仍以 `.invalid` 结尾；
- `WECHAT_LOCAL_MOCK_ENABLED` 不是 `false`；
- `deploy/.env.production` 已被 Git 跟踪；
- 任一必需测试失败。

## 1. 购买审批门禁

1. 由项目负责人确认预算、购买主体、区域和预计使用周期。
2. 待批准的资源仅包括：
   - 一台中国大陆地域、2 核 2 GB 的腾讯云轻量应用服务器；
   - 一个可备案的自有域名。
3. 购买前在腾讯云控制台确认实例满足当时的备案资源时长要求，并以结算页显示的配置和价格为准。
4. 未获得书面购买批准时停止。本仓库操作不授权购买、续费或开通任何云资源。

## 2. 核对域名注册人与备案主体

1. 确定备案主体是个人还是单位，并准备该主体要求的证件和负责人联系方式。
2. 使用境内有资质的注册服务机构注册域名并完成实名认证。
3. 核对域名注册人实名认证信息与备案主体一致；单位备案不得使用无关个人或其他单位作为域名注册人。
4. 确认域名在有效期内、后缀可备案且没有注册锁定等异常状态。
5. 注册人或主体不一致时停止，先在注册商和备案负责人指导下完成信息更正。

## 3. 完成 ICP 备案

1. 在腾讯云 ICP 备案控制台选择与实际情况一致的首次备案、接入备案或新增服务流程。
2. 选择本项目的中国大陆轻量应用服务器，按控制台要求填写主体和服务信息。
3. 上传要求的材料并由网站负责人完成视频核验，然后提交腾讯云初审。
4. 腾讯云把申请提交通信管理局后，负责人关注来自工信部的短信。验证码有效期为 24 小时，须在时限内进入工信部备案管理系统完成核验；超时或失败后按控制台指引重新提交，不得继续上线。
5. 等待通信管理局审核，并在工信部公共查询和腾讯云控制台确认备案号已生效。
6. 备案未通过前，不解析生产流量、不申请微信合法域名、不上传可误用的体验版。

不同省份材料和审核规则可能变化，以腾讯云备案控制台与当地通信管理局当次提示为准。

## 4. 配置业务子域名 DNS

1. 选定一个业务子域名，例如 `shop.<备案域名>`，作为后台、API 和商品图片的统一入口。
2. 在权威 DNS 控制台添加 `A` 记录：
   - 主机记录：业务子域名前缀，例如 `shop`；
   - 记录值：轻量应用服务器公网 IPv4 地址；
   - TTL：按变更窗口选择，稳定后可恢复默认值。
3. 从至少一个非服务器网络核对解析结果：

```bash
dig +short <business-subdomain>
```

Windows 可使用：

```powershell
Resolve-DnsName <business-subdomain> -Type A
```

4. 返回值不是目标公网 IP、存在冲突记录或备案尚未生效时停止。

## 5. 准备服务器

1. 安装 Docker Engine、Docker Compose v2 和 Git，并记录版本。
2. 创建专用的非 root 部署用户，只授予运行本项目所需权限；日常部署不得直接使用 root。
3. 使用 SSH 密钥登录。安全组和主机防火墙仅向必要来源开放 `22`，并向公众开放 `80`、`443`。
4. 不得向公网开放 Spring Boot、MySQL 或 Redis 端口，即 `8080`、`3306`、`6379`。
5. 克隆仓库并检出批准的提交或标签。服务器上不得保留开发者个人凭据。

## 6. 安装并检查 TLS 证书

1. 由域名或云平台管理员为业务子域名申请受信任的 TLS 证书。
2. 通过安全通道把证书链和私钥分别放到：

```text
deploy/certs/fullchain.pem
deploy/certs/privkey.pem
```

3. 限制目录和私钥读取权限，不在终端打印私钥内容，不把 `deploy/certs/` 提交 Git。
4. 部署后从外部网络检查证书链、有效期和主机名：

```bash
openssl s_client \
  -connect <business-subdomain>:443 \
  -servername <business-subdomain> \
  -verify_return_error </dev/null
```

证书链无效、主机名不匹配或证书过期时停止，不得关闭 HTTPS 校验。

## 7. 安全创建生产环境文件

先设置仅当前用户可读写的默认权限，再从安全示例创建文件：

```bash
umask 077
cp deploy/env.example deploy/.env.production
chmod 600 deploy/.env.production
```

使用不会回显内容或同步到云端的服务器本地编辑器填写 `deploy/.env.production`。不要用 `echo SECRET=...`、命令行参数、剪贴板历史或聊天消息传递密钥。要求：

- `PUBLIC_HOST` 只填写业务主机名，不含协议、路径、端口或通配符；
- AppID 填写已确认的小程序 AppID；
- AppSecret 仅由微信管理员在服务器安全终端填写；
- `WECHAT_LOCAL_MOCK_ENABLED=false`；
- 数据库应用密码、数据库 root 密码和 Redis 密码互不相同；
- `JWT_SECRET` 至少使用 32 个随机字节；
- `TLS_CERT_DIR=./certs`。

确认生产环境文件未被 Git 跟踪：

```bash
test -z "$(git ls-files -- deploy/.env.production)"
```

该命令失败或输出文件名时停止，先移出 Git 跟踪并完成相关密钥轮换。

## 8. 运行生产就绪检查

在仓库根目录执行：

```bash
node deploy/scripts/production-readiness.mjs \
  --env-file deploy/.env.production
```

检查器必须成功且不得输出环境变量值。任何错误都按错误项修复后重新运行；禁止修改脚本或示例值来规避失败。

## 9. 部署并完成健康与安全检查

先构建并测试管理后台，再渲染和启动生产 Compose：

```bash
npm --prefix admin ci
npm --prefix admin test -- --run
npm --prefix admin run build

docker compose \
  -f deploy/compose.production.yaml \
  --env-file deploy/.env.production \
  config >/dev/null

docker compose \
  -f deploy/compose.production.yaml \
  --env-file deploy/.env.production \
  up -d --build
```

检查容器、健康端点、HTTP 跳转、隐藏文件保护和监听端口：

```bash
docker compose \
  -f deploy/compose.production.yaml \
  --env-file deploy/.env.production \
  ps
curl --fail --silent https://<business-subdomain>/actuator/health
curl -I http://<business-subdomain>/
curl -I https://<business-subdomain>/.env
curl -I https://<business-subdomain>/database/
ss -lnt
```

预期健康端点返回 `{"status":"UP"}`，HTTP 跳转 HTTPS，隐藏文件和内部目录返回 403/404，公网入口只有 80/443。检查失败时停止微信配置。

## 10. 配置微信合法域名

这一步只能由具有小程序管理权限的人员在微信公众平台完成。

1. 进入对应小程序的开发配置或服务器域名页面。
2. 将统一 HTTPS 源 `https://<business-subdomain>` 配置为 `request 合法域名`，供登录、商品、订单和个人资料接口使用。
3. 将同一 HTTPS 源配置为 `downloadFile 合法域名`，供商品图片下载使用。
4. 域名不得包含路径、查询参数、端口或通配符；不得填写 IP、HTTP 地址、自签名证书地址或 `.invalid` 地址。
5. 当前版本不使用 `uploadFile` 和 WebSocket，不为未使用的能力扩大域名范围。
6. 保存后重新打开配置页面，确认两个条目均已生效。

平台拒绝域名时，核对备案生效状态、证书链和小程序主体权限，不得在开发者工具中勾选“忽略合法域名校验”作为体验版解决方案。

## 11. 同步小程序体验版与正式版源地址

在本地仓库根目录把业务主机名作为纯主机名传入工具：

```powershell
$env:PUBLIC_HOST = '<business-subdomain>'
node deploy/scripts/configure-mini-origin.mjs --host $env:PUBLIC_HOST
npm --prefix mini test -- --run
npm --prefix mini run typecheck
Remove-Item Env:PUBLIC_HOST
```

检查 `mini/miniprogram/config/env.ts` 中 `trial` 和 `release` 均为同一个 `https://<business-subdomain>`，而 `develop` 仍指向本地开发环境。任一公开源仍为 `.invalid`、两者不一致或测试失败时停止。

不要修改、覆盖或提交开发者已有的 `mini/project.config.json` AppID 变更。

## 12. 上传并选择微信体验版

这一步只能由已登录且有上传权限的开发者在微信开发者工具和微信公众平台完成。

1. 使用与目标小程序一致的真实 AppID 打开 `mini/` 项目，确认当前 Git 提交、构建输出和第 11 节测试记录。
2. 关闭“不校验合法域名、web-view、TLS 版本以及 HTTPS 证书”等仅开发调试选项，进行一次编译和预览。
3. 在开发者工具中选择“上传”，填写可追溯的版本号和说明；说明只写提交、变更摘要和验收范围，不写密钥。
4. 在微信公众平台的成员管理中添加批准的体验成员。由体验成员本人接受或确认权限。
5. 在版本管理中找到本次上传的开发版本，选择为体验版，并核对体验版时间、版本号和上传者。
6. 仅把体验二维码发给批准的体验成员，不公开传播。

若平台页面名称因版本调整而变化，以当前小程序管理后台中对应的“成员管理”“版本管理”“开发版本/体验版”入口为准。

## 13. 真机验证

至少使用一台不连接开发代理的真实手机，并覆盖移动网络和 Wi-Fi：

1. 真实 `wx.login` 登录成功，服务端没有启用模拟登录；
2. 商品列表、详情和商品图片正常加载；
3. 完成下单、接单、备货、付款、完成的订单闭环；
4. 现金支付路径至少验证一次；
5. 门店微信收款码路径至少验证一次；
6. 下单、取消和履约后的库存、库存流水与订单状态一致；
7. 后台、订单历史和审计记录一致，日志不出现密码、JWT、AppSecret 或 `session_key`。

发现证书、合法域名、登录、图片、订单或库存问题时，停止体验扩大和正式提审，记录 `X-Request-Id`、时间和不含隐私的复现步骤。

## 14. 试营业签字门禁

逐项完成并签署 [智慧超市 MVP 试营业验收单](trial-acceptance.md)。至少 5 位体验成员完成真实微信登录，至少 10 笔订单完成全流程；现金和门店微信收款码各验证至少一次。

验收单未签署、存在阻断缺陷或备份恢复演练未完成时，不得提交审核或发布正式版。

## 15. 回滚与密钥轮换

### 应用与体验版回滚

1. 暂停新的体验操作，记录失败版本、时间、影响范围和 `X-Request-Id`。
2. 服务器检出上一个已批准的提交或标签，重新构建管理后台并执行生产 Compose 的 `up -d --build`。
3. 重新运行第 8、9 节检查。
4. 在微信公众平台版本管理中把上一个已验证的开发版本重新选为体验版；若平台不保留可选版本，则从上一个批准提交重新构建、上传并选择。
5. 不得用开启微信模拟登录、关闭合法域名校验或改回 HTTP 的方式回滚。

### 数据回滚

Flyway 迁移只前进，不手工删除或修改 `flyway_schema_history`。若版本包含不兼容迁移，先停止写入，再严格按 [备份与恢复手册](backup-and-restore.md) 恢复数据库和图片卷；恢复后重新完成订单与库存一致性检查。

### 密钥泄露或人员变更

1. 立即停止受影响部署并限制服务器访问。
2. 由各平台管理员在对应外部控制台轮换 AppSecret、证书或云访问凭据；本地人员不能代办。
3. 在服务器安全编辑器中更新 `deploy/.env.production`，同时轮换可能受影响的 JWT、数据库和 Redis 密钥。
4. 重建受影响容器、使旧会话失效，并重新运行生产就绪检查和真机登录。
5. 只记录轮换时间、负责人和结果，不记录旧值或新值。

## 官方参考

- [腾讯云：轻量应用服务器 ICP 备案](https://cloud.tencent.com/document/product/1207/45756)
- [腾讯云：备案流程](https://cloud.tencent.com/document/product/243/18909)
- [腾讯云：备案工信部短信核验说明](https://cloud.tencent.com/document/product/243/13435)
- [腾讯云：轻量应用服务器添加域名解析](https://cloud.tencent.com/document/product/1207/81333)
- [微信开放文档：小程序网络能力](https://developers.weixin.qq.com/miniprogram/dev/framework/ability/network.html)
