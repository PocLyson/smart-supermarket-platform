# 生产部署手册

## 1. 前置条件

- Linux 主机已安装 Docker Engine、Docker Compose v2、Git。
- 域名已解析到主机，防火墙仅开放 22、80、443。
- 微信公众平台已配置合法请求域名。
- 已准备受信任证书 `fullchain.pem` 与 `privkey.pem`。
- 发布前已完成 [试营业验收](trial-acceptance.md) 和 [恢复演练](backup-and-restore.md)。

## 2. 构建管理后台

```bash
git clone <repository-url> smart-store
cd smart-store
npm --prefix admin ci
npm --prefix admin test -- --run
npm --prefix admin run build
```

`admin/dist` 必须存在，Nginx 容器会只读挂载该目录。

## 3. 配置环境

```bash
cp deploy/env.example deploy/.env.production
chmod 600 deploy/.env.production
mkdir -p deploy/certs
install -m 600 /secure/path/fullchain.pem deploy/certs/fullchain.pem
install -m 600 /secure/path/privkey.pem deploy/certs/privkey.pem
```

编辑 `deploy/.env.production`，替换全部 `replace-with-...` 值。要求：

- MySQL 应用密码、root 密码和 Redis 密码互不相同；
- `JWT_SECRET` 使用密码管理器生成至少 32 个随机字节；
- 微信 AppSecret 只保存在权限为 600 的环境文件中；
- `TLS_CERT_DIR=./certs`；
- 环境文件、证书和备份均不得提交 Git。

部署前校验：

```bash
docker compose \
  -f deploy/compose.production.yaml \
  --env-file deploy/.env.production \
  config >/dev/null
```

## 4. 首次启动与 Flyway

```bash
docker compose \
  -f deploy/compose.production.yaml \
  --env-file deploy/.env.production \
  up -d --build

docker compose \
  -f deploy/compose.production.yaml \
  --env-file deploy/.env.production \
  ps

docker compose \
  -f deploy/compose.production.yaml \
  --env-file deploy/.env.production \
  logs --tail=200 server
```

后端启动时自动执行 Flyway。只有日志出现迁移成功且 `server` 健康后，Nginx 才开始接流量。禁止手工修改 `flyway_schema_history`。

健康检查：

```bash
curl --fail --silent https://<trial-domain>/actuator/health
```

应返回 `{"status":"UP"}`。生产域名不得直接暴露 8080、3306 或 6379。

## 5. 初始化老板账号

在安全终端生成一次性 BCrypt 哈希，不把明文写入 shell 历史：

```bash
read -s -p "Temporary owner password: " OWNER_PASSWORD
echo
OWNER_HASH="$(docker run --rm httpd:2.4-alpine \
  htpasswd -bnBC 12 "" "$OWNER_PASSWORD" | tr -d ':\n')"
unset OWNER_PASSWORD
```

写入唯一老板账号：

```bash
source deploy/.env.production
docker compose \
  -f deploy/compose.production.yaml \
  --env-file deploy/.env.production \
  exec -T mysql mysql \
  -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" \
  -e "INSERT INTO staff_account(username,password_hash,role,enabled)
      VALUES ('owner','$OWNER_HASH','OWNER',TRUE);"
unset OWNER_HASH
```

首次登录后立即通过受控流程更换密码，再由老板创建至少一个收银员账号。不得直接创建 `CASHIER` 以外的额外角色。

## 6. 导入试营业商品

先审阅 SQL，再在仅初始化一次的试营业库执行：

```bash
source deploy/.env.production
docker compose \
  -f deploy/compose.production.yaml \
  --env-file deploy/.env.production \
  exec -T mysql mysql \
  -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" \
  < database/seed/010_trial_catalog.sql
```

种子脚本创建 30 个上架商品及线上库存。随后必须在后台核对价格、图片和实际可售数量。

在 Windows PowerShell 中不要通过 `Get-Content ... | mysql` 导入含中文的 SQL。应先把原始 UTF-8 文件复制进容器，再让容器内的 MySQL 客户端读取：

```powershell
docker compose -f deploy/compose.production.yaml --env-file deploy/.env.production `
  cp database/seed/010_trial_catalog.sql mysql:/tmp/010_trial_catalog.sql
docker compose -f deploy/compose.production.yaml --env-file deploy/.env.production `
  exec -T mysql sh -lc 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" -e "source /tmp/010_trial_catalog.sql"'
```

## 7. HTTPS 与安全检查

```bash
curl -I http://<trial-domain>/
curl -I https://<trial-domain>/
curl -I https://<trial-domain>/.env
curl -I https://<trial-domain>/database/
```

预期：HTTP 跳转 HTTPS；HTTPS 正常；隐藏文件和内部目录返回 403/404。检查证书续期任务，并在续期后执行：

```bash
docker compose -f deploy/compose.production.yaml exec nginx nginx -s reload
```

## 8. 发布、回滚与日志

常规发布：

```bash
git fetch --tags
git checkout <approved-release-tag>
npm --prefix admin ci
npm --prefix admin run build
docker compose \
  -f deploy/compose.production.yaml \
  --env-file deploy/.env.production \
  up -d --build
```

应用回滚：检出上一个已批准标签并重新执行构建、`up -d --build`。Flyway 迁移只前进不回滚；若新版本包含不兼容迁移，必须先停写，再按备份手册恢复数据库和图片，不能删除迁移记录。

日志位置：

```bash
docker compose -f deploy/compose.production.yaml logs -f server
docker compose -f deploy/compose.production.yaml logs -f nginx
docker compose -f deploy/compose.production.yaml logs --since=30m mysql redis
```

业务错误使用响应和日志中的 `X-Request-Id` 关联。日志不得记录 JWT、密码、微信 `session_key` 或环境变量值。
