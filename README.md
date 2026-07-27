# 智慧超市平台

鲁能超市李老家分店智慧超市 MVP，采用微信原生小程序、Vue 3 管理后台、Spring Boot 3 后端、MySQL 8 与 Redis。

## 本地基础设施

开发环境的 `compose.yaml` 只启动 MySQL 与 Redis：

```powershell
docker compose up -d
```

本地开发专用数据库配置：

- 地址：`jdbc:mysql://localhost:3306/smart_store`
- 用户：`smart_store`
- 密码：`smart_store_dev`
- root 密码：`root_dev_only`

这些凭据只能用于开发机，不得用于测试、试运营或生产环境。

## 后端

需要 JDK 17。所有敏感配置均通过环境变量提供：

```powershell
$env:JAVA_HOME = 'C:\Program Files\Microsoft\jdk-17.0.20'
$env:DB_URL = 'jdbc:mysql://localhost:3306/smart_store'
$env:DB_USERNAME = 'smart_store'
$env:DB_PASSWORD = 'smart_store_dev'
$env:REDIS_HOST = 'localhost'
$env:REDIS_PORT = '6379'
$env:JWT_SECRET = '<至少 32 字节随机值>'
$env:WECHAT_APP_ID = '<微信小程序 AppId>'
$env:WECHAT_APP_SECRET = '<微信小程序 AppSecret>'
$env:UPLOAD_DIR = '<商品图片绝对目录>'

cd server
.\mvnw.cmd spring-boot:run
```

健康检查地址：`GET http://localhost:8080/actuator/health`。
