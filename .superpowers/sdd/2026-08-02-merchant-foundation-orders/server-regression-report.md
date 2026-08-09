# Phase 1 服务端全量回归报告

日期：2026-08-09

## 结论

服务端回归已恢复。修复仅更新无基础设施的应用上下文烟雾测试，用 `@MockitoBean` 替换新增的 `MerchantAuthService` 应用服务边界；生产认证服务、JPA 仓储和商户小程序前端均未修改。

## 系统化诊断

### 1. 失败读取与可靠复现

先完整读取 `server/target/surefire-reports` 中三个指定测试的文本与 XML 报告，再在未改代码的状态运行：

```powershell
& .\server\mvnw.cmd -f server\pom.xml '-Dtest=InventoryServiceTest,OrderApplicationServiceTest,SmartStoreApplicationTest' test
```

进程退出码为 `1`。本次新鲜复现的实际基线为：

- `InventoryServiceTest`：1/1 通过。
- `OrderApplicationServiceTest`：3/3 通过。
- `SmartStoreApplicationTest`：1 个 ApplicationContext error，根异常为无法注入 `StaffWechatBindingRepository`。

因此，任务描述中的 5 个错误属于此前全量运行表象；当前可靠复现把故障收敛为同一无基础设施烟雾上下文中的 1 个错误。

### 2. 模式比较与根因

认证提交 `28ae707` 新增了以下生产依赖链：

`MerchantAuthController -> MerchantAuthService -> StaffWechatBindingRepository`

生产与 Testcontainers 集成测试上下文启用 DataSource/JPA；定向运行日志显示 Spring Data 扫描到 6 个 JPA 仓储，`StaffWechatBindingRepository` 能正常创建。现有 `MerchantAuthApiTest` 也使用真实 `MerchantAuthService` 和真实仓储，历史报告为 9/9 通过。

`SmartStoreApplicationTest` 则明确排除了 DataSource、Redis 和 Flyway，并沿用“以 `@MockitoBean` 替换应用服务边界”的测试模式。认证功能加入新 Controller/Service 后，该测试没有同步替换 `MerchantAuthService`，Spring 因而尝试实例化真实服务，并在被刻意关闭的 JPA 基础设施中找不到其仓储依赖。

单一根因：无基础设施烟雾测试的服务替换清单没有随新增商户认证应用服务更新，而非生产 JPA 仓储注册错误。

正确模式是：

- 生产/集成上下文保留真实 JPA 仓储，由 DataSource 与 Spring Data 创建 bean。
- 刻意关闭基础设施的应用烟雾测试在应用服务边界使用 `@MockitoBean`。
- 不给生产代码增加条件 bean、内存兜底或可选注入来迁就测试上下文。

## RED / GREEN

RED：上述三类定向命令退出 `1`；指定 5 个测试方法中 4 个通过、1 个 ApplicationContext error。

最小修复：仅在 `SmartStoreApplicationTest` 增加 `MerchantAuthService` 的 `@MockitoBean`。

GREEN：以相同命令重跑，退出 `0`，结果为 `Tests run: 5, Failures: 0, Errors: 0, Skipped: 0`。

## 全量验证

运行：

```powershell
& .\server\mvnw.cmd -f server\pom.xml clean verify
```

结果：

- Maven 退出码：`0`。
- Maven：`BUILD SUCCESS`，总耗时 `06:56 min`。
- Surefire：32 个测试套件，102 个测试，0 failures，0 errors，0 skipped。
- XML 报告独立求和结果与 Maven 汇总一致。
- 项目未配置/生成 Failsafe 报告；`verify` 已完成 jar 和 Spring Boot repackage。

## 提交

独立提交主题：`test: restore application context smoke test`
