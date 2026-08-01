# 公告与商家联系方式终审修复报告

## 状态

- 终审前 Head：`038c458`
- 修复范围：仅处理终审列出的 5 项 findings；未改变公告状态机、角色权限或页面主布局。
- 结果：全部 findings 已修复，三端聚焦与全量回归通过。

## Finding 修复

### 1. mini 公告公开 DTO

- 新增 `PublicAnnouncementView`，字段严格为 `id/title/content/publishedAt`。
- `MiniAnnouncementController` 的 latest/list/detail 均显式从后台 `AnnouncementView` 映射为公开 DTO。
- 单元合同与 MockMvc API 测试均断言 `status/createdBy/updatedBy/createdAt/updatedAt` 不存在。

### 2. lifecycle 防重复与服务端并发控制

- admin 使用按公告 id 保存的 lifecycle pending action；从确认框打开前到 API 与刷新结束期间，同一行的发布、下线、删除互斥，按钮同步 disabled/loading，其他行不受影响。
- `AnnouncementRepository.findByIdForUpdate` 使用 `@Lock(PESSIMISTIC_WRITE)`；update/publish/offline/delete 都在现有事务内通过该行锁读取。
- 真实 MySQL 并发测试用两个线程同时 publish、同时 offline，分别只允许一次状态变化和一次对应审计；顺序调用的既有幂等测试继续通过。

### 3. 公告详情错误分流

- mini HTTP 客户端新增结构化 `HttpResponseError`，保留 `statusCode/code/requestId`，不依赖错误文案匹配。
- 详情失败分类只将 HTTP 404 或业务 `NOT_FOUND` 映射为“该公告已结束”。
- 网络、超时、5xx 和其他业务错误映射为明确的“公告加载失败，请检查网络后重新加载”错误态，并提供“重新加载”按钮复用当前公告 id。

### 4. published 稳定排序

- list 使用 `publishedAt DESC, id DESC` 的 Spring Data repository contract。
- latest 使用相同次序。
- 保留等时间数据集成测试，并新增 repository contract 测试，防止 tie-breaker 从 list/latest 任一路径回退。

### 5. 联系方式双层校验与回退

- `StoreContactProperties` 启用 configuration properties validation；phone 同时要求非空与中国大陆手机号格式 `^1[3-9]\\d{9}$`，非法配置在启动绑定期失败。
- mini 对成功响应中的空号或非法号也回退 `18653045492`，并设置 `customerServiceEnabled=false` 隐藏在线客服。

## TDD RED / GREEN 记录

1. 公开 DTO
   - RED：`MiniAnnouncementControllerTest` 期望 4 字段，实际得到 9 字段，多出 5 个内部字段；1 test failed。
   - GREEN：相同测试 1/1 通过；API 集成断言随后纳入聚焦回归。
2. admin pending guard
   - RED：`AnnouncementView.spec.ts` 双击同一发布按钮，确认框实际调用 2 次；1/11 failed。
   - GREEN：同套件 11/11 通过，并断言同一行 disabled、其他行可操作、API 仅调用一次。
3. 服务端并发
   - RED：真实 MySQL/Testcontainers 并发 publish 期望 1 条审计，实际 2 条；1 test failed。
   - GREEN：加悲观写锁后同一并发测试 1/1 通过，publish/offline 各一条审计。
4. 详情错误结构与状态
   - RED：404 测试期望 `HttpResponseError`，实际为普通 `Error`；1/7 failed。
   - GREEN：HTTP 套件 7/7 通过。
   - RED：详情状态测试因分类模块不存在而失败；0 tests collected。
   - GREEN：公告 + HTTP 聚焦 13/13 通过，mini typecheck 通过。
5. 稳定排序
   - 首个等时间集成测试在 MySQL 二级索引的偶然扫描顺序下，移除 `id DESC` 后仍可通过，因此不能单独证明合同。
   - RED：加强后的 repository contract 测试明确缺少两个 `...PublishedAtDescIdDesc` 方法；1 test failed。
   - GREEN：恢复稳定次序后合同测试 1/1 通过；等时间集成测试也在服务套件内通过。
6. 联系方式校验
   - RED：空/非法 phone 的配置上下文仍启动；`StoreContactPropertiesTest` 1/2 failed。
   - RED：mini 对空/非法成功响应原样返回；`merchant-contact.spec.ts` 2/8 failed。
   - GREEN：服务端 2/2、mini 8/8 通过。
7. 全量发现的测试夹具缺口
   - RED：首次 server `clean test` 的唯一失败为 `SmartStoreApplicationTest` 排除 JPA 后未 mock 新增的 `AnnouncementRepository`。
   - GREEN：补齐 test fixture 后单类 1/1、server 全量 63/63 通过。

## 验证摘要

- server 聚焦：15/15 通过（随后稳定排序合同单测 1/1 通过）。
- server 全量：`mvnw test`，63/63 通过，真实 MySQL 8.4 + Redis 7.4 Testcontainers，总耗时 5:32。
- admin 聚焦：11/11 通过。
- admin 全量：67/67 通过。
- admin production build：`vue-tsc --noEmit && vite build` 通过。
- mini 聚焦：32/32 通过。
- mini 全量：132/132 通过。
- mini typecheck：`tsc --noEmit` 通过。
- `git diff --check`：通过。

## 修改文件

### server production

- `server/src/main/java/com/luneng/smartstore/announcement/PublicAnnouncementView.java`
- `server/src/main/java/com/luneng/smartstore/announcement/MiniAnnouncementController.java`
- `server/src/main/java/com/luneng/smartstore/announcement/AnnouncementRepository.java`
- `server/src/main/java/com/luneng/smartstore/announcement/AnnouncementService.java`
- `server/src/main/java/com/luneng/smartstore/store/StoreContactProperties.java`

### server tests

- `server/src/test/java/com/luneng/smartstore/announcement/MiniAnnouncementControllerTest.java`
- `server/src/test/java/com/luneng/smartstore/announcement/AnnouncementRepositoryContractTest.java`
- `server/src/test/java/com/luneng/smartstore/announcement/AnnouncementApiTest.java`
- `server/src/test/java/com/luneng/smartstore/announcement/AnnouncementServiceTest.java`
- `server/src/test/java/com/luneng/smartstore/store/StoreContactPropertiesTest.java`
- `server/src/test/java/com/luneng/smartstore/SmartStoreApplicationTest.java`

### admin

- `admin/src/views/announcements/AnnouncementView.vue`
- `admin/tests/AnnouncementView.spec.ts`

### mini

- `mini/miniprogram/services/http.ts`
- `mini/miniprogram/pages/announcement-detail/state.ts`
- `mini/miniprogram/pages/announcement-detail/index.ts`
- `mini/miniprogram/pages/announcement-detail/index.wxml`
- `mini/miniprogram/utils/merchant-contact.ts`
- `mini/tests/http.spec.ts`
- `mini/tests/announcements.spec.ts`
- `mini/tests/merchant-contact.spec.ts`

## 自审

- 公告公开边界仅缩小响应，不改变后台 DTO 或后台页面合同。
- 行锁覆盖所有公告写操作，避免 publish 与 update/delete 等写动作交错；只读查询仍保持 read-only transaction。
- lifecycle pending 以行维度隔离，不引入全页阻塞，不改变现有确认文案与布局。
- 详情错误分类基于结构字段而非字符串；NOT_FOUND 与重试态互斥。
- 手机号服务端与客户端使用同一格式约束；客户端回退对象必定隐藏客服。
- 无数据库迁移、权限规则、公告状态与 UI 主布局变化。

## Concerns

- server 编译仍显示既有 `AuditService` deprecated API 警告；与本轮无关。
- Flyway 对 MySQL 8.4 显示“已测试支持到 8.1”的既有兼容性提示；迁移与 63 个测试均成功。
- 为运行真实 server 集成测试，后台启动了本机 Docker Desktop，并在 Maven 子进程中临时移除了一个既有 malformed PATH 项；未修改系统 PATH。
