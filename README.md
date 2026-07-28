# 智慧超市平台

智慧超市 MVP 包含微信顾客端、后台管理端与 Spring Boot 服务端。本工作区中的后端实现覆盖商品目录、在线库存、顾客认证、订单创建与取消、后台订单履约、员工权限、图片上传、审计日志和限流。

## 目录

- `server/`：Spring Boot 3 / Java 17 后端
- `database/`：Flyway 数据库迁移与试运营种子数据
- `deploy/`：生产 Compose、Nginx 与服务端镜像配置
- `docs/api/`：冻结的 MVP API 契约
- `docs/operations/`：部署、备份恢复和试运营验收手册
- `admin/`：后台管理端
- `mini/`：微信小程序端

## 本地启动

前置条件：Docker Desktop、JDK 17。

```powershell
docker compose up -d
cd server
.\mvnw.cmd spring-boot:run
```

如果本机已有 MySQL 占用 `3306`，可指定其他主机端口：

```powershell
$env:MYSQL_PORT = "3307"
docker compose up -d
$env:DB_URL = "jdbc:mysql://localhost:3307/smart_store"
```

本地默认连接：

- MySQL：`localhost:3306/smart_store`
- Redis：`localhost:6379`
- 服务端：`http://localhost:8080`
- 健康检查：`http://localhost:8080/actuator/health`

服务端支持通过环境变量覆盖数据库、Redis、JWT、微信登录和上传目录配置。生产环境必须设置强随机 `JWT_SECRET`、数据库密码、Redis 密码，并配置真实微信凭据。

首次准备本地试营业商品时，请让 MySQL 在容器内直接读取 UTF-8 文件。不要使用 PowerShell 的 `Get-Content ... | mysql` 文本管道，它可能把中文替换为问号。

```powershell
docker compose cp database/seed/010_trial_catalog.sql mysql:/tmp/010_trial_catalog.sql
docker compose exec -T mysql mysql -uroot -proot_dev_only smart_store -e "source /tmp/010_trial_catalog.sql"
```

## 测试

```powershell
cd server
.\mvnw.cmd clean verify
```

集成测试使用 Testcontainers，需要 Docker 正常运行。

## 文档

- [MVP API 契约](docs/api/mvp-api.md)
- [生产部署](docs/operations/deployment.md)
- [域名、备案与微信体验版](docs/operations/domain-and-wechat-trial.md)
- [备份与恢复](docs/operations/backup-and-restore.md)
- [试运营验收](docs/operations/trial-acceptance.md)

真实生产配置必须先运行就绪检查，再渲染 Compose：

```powershell
node deploy/scripts/production-readiness.mjs `
  --env-file deploy/.env.production
docker compose -f deploy/compose.production.yaml `
  --env-file deploy/.env.production config
```

在尚未取得备案域名、证书和生产密钥时，可用示例环境文件做 Compose 静态校验：

```powershell
docker compose -f deploy/compose.production.yaml --env-file deploy/env.example config
```

请勿直接使用 `deploy/env.example` 中的占位凭据部署生产环境。
