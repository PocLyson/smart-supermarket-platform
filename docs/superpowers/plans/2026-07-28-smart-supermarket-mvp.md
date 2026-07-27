# 智慧超市 MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付可在鲁能超市李老家分店小范围试运营的“微信小程序下单、门店接单备货、到店线下付款取货”完整业务闭环。

**Architecture:** 单仓库包含微信原生小程序、Vue 3 管理后台和 Spring Boot 3 模块化单体后端。后端按认证、商品、库存、订单、员工与审计分包；MySQL 是核心数据唯一事实来源，Redis 只保存可重建的短期状态。

**Tech Stack:** Java 17、Spring Boot 3.5.9、Maven、Spring Security、Spring Data JPA、Flyway、MySQL 8、Redis、Vue 3、TypeScript、Vite、Vue Router、Pinia、Element Plus、Vitest、微信原生小程序、TDesign MiniProgram、TDesign Icons。

## Global Constraints

- 顾客端必须使用微信原生小程序。
- 管理后台必须使用 Vue 3 + Element Plus。
- 小程序组件库必须使用 TDesign MiniProgram，图标统一使用 TDesign Icons；不得混用 Vant Weapp、WeUI 等其他完整组件库。
- 小程序基础交互组件优先复用 TDesign，首页业务卡片、商品卡片、分类入口和推荐专区按项目视觉规范自定义。
- 管理后台与小程序均须映射“深绛红”主题变量，禁止直接套用组件库默认品牌色或零售模板视觉。
- 后端必须使用 Java 17 + Spring Boot 3。
- 核心数据必须保存于 MySQL 8；Redis 不得成为核心数据唯一来源。
- 认证与授权使用 JWT，顾客和员工使用隔离的认证入口及权限规则。
- MVP 只支持普通定量商品、到店自取、现金或门店微信收款码线下付款。
- 线上可售库存独立管理，不自动同步线下收银库存。
- 金额一律以人民币“分”为单位使用整数存储和计算。
- 顾客在门店接单前可以自行取消；接单后只能由门店取消。
- 只有已付款且处于“待取货”的订单才能完成。
- 已完成订单不能取消；MVP 不包含退款、售后、配送、在线支付、称重、预定和营销。
- 所有功能遵循测试先行；每个任务通过本任务验证后单独提交。

---

## 1. Locked File Structure

```text
.
├── .editorconfig
├── .gitignore
├── README.md
├── compose.yaml
├── admin/
│   ├── package.json
│   ├── package-lock.json
│   ├── vite.config.ts
│   ├── vitest.config.ts
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   ├── layouts/
│   │   ├── router/
│   │   ├── stores/
│   │   ├── types/
│   │   └── views/
│   └── tests/
├── mini/
│   ├── package.json
│   ├── package-lock.json
│   ├── project.config.json
│   ├── tsconfig.json
│   ├── miniprogram/
│   │   ├── app.ts
│   │   ├── app.json
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── store/
│   │   ├── types/
│   │   └── utils/
│   └── tests/
├── server/
│   ├── pom.xml
│   ├── mvnw
│   ├── mvnw.cmd
│   ├── .mvn/wrapper/
│   └── src/
│       ├── main/java/com/luneng/smartstore/
│       │   ├── SmartStoreApplication.java
│       │   ├── common/
│       │   ├── auth/
│       │   ├── customer/
│       │   ├── staff/
│       │   ├── catalog/
│       │   ├── inventory/
│       │   ├── order/
│       │   ├── audit/
│       │   └── file/
│       ├── main/resources/
│       │   ├── application.yml
│       │   └── db/migration/
│       └── test/java/com/luneng/smartstore/
├── database/
│   └── seed/
├── deploy/
│   ├── nginx/
│   ├── compose.production.yaml
│   └── env.example
└── docs/
    ├── api/
    ├── operations/
    └── superpowers/
```

Package-by-feature is mandatory. A feature may contain its controller, DTOs, application service, entity and repository; do not recreate global `controller/service/repository` layer folders.

---

### Task 1: Repository and Backend Health Foundation

**Files:**
- Create: `.editorconfig`
- Create: `.gitignore`
- Create: `README.md`
- Create: `compose.yaml`
- Create: `server/pom.xml`
- Create: `server/mvnw`
- Create: `server/mvnw.cmd`
- Create: `server/.mvn/wrapper/maven-wrapper.properties`
- Create: `server/src/main/java/com/luneng/smartstore/SmartStoreApplication.java`
- Create: `server/src/main/resources/application.yml`
- Create: `server/src/test/java/com/luneng/smartstore/SmartStoreApplicationTest.java`

**Interfaces:**
- Consumes: none.
- Produces: executable backend on port `8080`; MySQL at `localhost:3306`; Redis at `localhost:6379`; health endpoint `GET /actuator/health`.

- [ ] **Step 1: Write the failing context test**

```java
package com.luneng.smartstore;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(properties = {
    "spring.autoconfigure.exclude="
        + "org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration,"
        + "org.springframework.boot.autoconfigure.data.redis.RedisAutoConfiguration,"
        + "org.springframework.boot.autoconfigure.flyway.FlywayAutoConfiguration"
})
class SmartStoreApplicationTest {
    @Test
    void contextLoads() {
    }
}
```

- [ ] **Step 2: Run the test and verify the project is not scaffolded**

Run: `cd server; mvn test -Dtest=SmartStoreApplicationTest`

Expected: FAIL because `pom.xml` or `SmartStoreApplication` does not exist.

- [ ] **Step 3: Create the Maven application**

Use Spring Boot parent `3.5.9`, Java `17`, and these dependencies without overriding versions managed by Spring Boot:

```xml
<dependencies>
  <dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-web</artifactId>
  </dependency>
  <dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-actuator</artifactId>
  </dependency>
  <dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-validation</artifactId>
  </dependency>
  <dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-security</artifactId>
  </dependency>
  <dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-security-oauth2-jose</artifactId>
  </dependency>
  <dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-jpa</artifactId>
  </dependency>
  <dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-redis</artifactId>
  </dependency>
  <dependency>
    <groupId>org.flywaydb</groupId>
    <artifactId>flyway-core</artifactId>
  </dependency>
  <dependency>
    <groupId>org.flywaydb</groupId>
    <artifactId>flyway-mysql</artifactId>
  </dependency>
  <dependency>
    <groupId>com.mysql</groupId>
    <artifactId>mysql-connector-j</artifactId>
    <scope>runtime</scope>
  </dependency>
  <dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-test</artifactId>
    <scope>test</scope>
  </dependency>
  <dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-testcontainers</artifactId>
    <scope>test</scope>
  </dependency>
  <dependency>
    <groupId>org.testcontainers</groupId>
    <artifactId>mysql</artifactId>
    <scope>test</scope>
  </dependency>
  <dependency>
    <groupId>org.testcontainers</groupId>
    <artifactId>testcontainers</artifactId>
    <scope>test</scope>
  </dependency>
</dependencies>
```

Create `SmartStoreApplication` with `@SpringBootApplication`. Configure `application.yml` exclusively from `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `REDIS_HOST`, `REDIS_PORT`, `JWT_SECRET`, `WECHAT_APP_ID`, `WECHAT_APP_SECRET`, and `UPLOAD_DIR`; provide safe local defaults only for non-secret host and port values.

Create `compose.yaml` with MySQL 8 and Redis services, named volumes, health checks, and a development-only database/password documented in `README.md`.

- [ ] **Step 4: Run the foundation checks**

Run: `docker compose config`

Expected: exit code 0.

Run: `cd server; .\mvnw.cmd test -Dtest=SmartStoreApplicationTest`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add .editorconfig .gitignore README.md compose.yaml server
git commit -m "build: scaffold smart store backend"
```

---

### Task 2: Database Schema and Shared API Contract

**Files:**
- Create: `server/src/main/resources/db/migration/V1__create_mvp_schema.sql`
- Create: `server/src/main/java/com/luneng/smartstore/common/api/ApiResponse.java`
- Create: `server/src/main/java/com/luneng/smartstore/common/api/BusinessException.java`
- Create: `server/src/main/java/com/luneng/smartstore/common/api/GlobalExceptionHandler.java`
- Create: `server/src/main/java/com/luneng/smartstore/common/web/RequestIdFilter.java`
- Create: `server/src/test/java/com/luneng/smartstore/support/IntegrationTestBase.java`
- Create: `server/src/test/java/com/luneng/smartstore/common/DatabaseMigrationTest.java`
- Create: `server/src/test/java/com/luneng/smartstore/common/api/GlobalExceptionHandlerTest.java`

**Interfaces:**
- Consumes: MySQL connection from Task 1.
- Produces: tables `customer_user`, `staff_account`, `category`, `product`, `online_inventory`, `inventory_ledger`, `customer_order`, `order_item`, `order_status_history`, `operation_log`, `idempotency_record`; response type `ApiResponse<T>(String code, String message, String requestId, T data)`.

- [ ] **Step 1: Write failing migration and error-contract tests**

```java
@Test
void flywayCreatesEveryMvpTable() {
    var names = jdbcTemplate.queryForList(
        "select table_name from information_schema.tables where table_schema = database()",
        String.class
    );
    assertThat(names).contains(
        "customer_user", "staff_account", "category", "product",
        "online_inventory", "inventory_ledger", "customer_order",
        "order_item", "order_status_history", "operation_log",
        "idempotency_record"
    );
}
```

```java
@Test
void validationErrorUsesStableEnvelope() throws Exception {
    mockMvc.perform(post("/test/validation").contentType(APPLICATION_JSON).content("{}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
        .andExpect(jsonPath("$.requestId").isNotEmpty());
}
```

- [ ] **Step 2: Run tests and verify failure**

Run: `cd server; .\mvnw.cmd test -Dtest=DatabaseMigrationTest,GlobalExceptionHandlerTest`

Expected: FAIL because the migration and shared API classes do not exist.

- [ ] **Step 3: Implement the schema and shared contract**

The migration must enforce:

- `price_cent`, `total_cent`, `unit_price_cent`, and `subtotal_cent` are `BIGINT UNSIGNED`.
- quantities are positive `INT UNSIGNED`.
- `online_inventory.available_quantity` has a check constraint `>= 0` and a `version` column.
- `customer_order.order_no` and `(customer_id, idempotency_key)` are unique.
- status values use `VARCHAR(32)` plus application enums, not database-specific enum types.
- every mutable table has `created_at` and `updated_at`.
- foreign keys prevent orphaned order items and inventory ledgers.

Implement:

```java
public record ApiResponse<T>(
    String code,
    String message,
    String requestId,
    T data
) {
    public static <T> ApiResponse<T> success(String requestId, T data) {
        return new ApiResponse<>("OK", "成功", requestId, data);
    }
}
```

`GlobalExceptionHandler` maps validation to `VALIDATION_ERROR`, missing records to `NOT_FOUND`, illegal state transitions to `ORDER_STATE_CONFLICT`, stock failures to `INSUFFICIENT_STOCK`, access denial to `FORBIDDEN`, and unexpected errors to `INTERNAL_ERROR` without returning stack traces.

Create `IntegrationTestBase` with a static MySQL container and a static Redis `GenericContainer`, then register JDBC and Redis properties through `@DynamicPropertySource`. All tests that exercise migrations, repositories, Redis sessions, transactions, or concurrency must extend this base; tests must never depend on a developer's locally running database.

- [ ] **Step 4: Run migration and API-contract tests**

Run: `cd server; .\mvnw.cmd test -Dtest=DatabaseMigrationTest,GlobalExceptionHandlerTest`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add server/src/main/resources/db server/src/main/java/com/luneng/smartstore/common server/src/test/java/com/luneng/smartstore/common
git commit -m "feat: add MVP schema and API error contract"
```

---

### Task 3: Staff Authentication and Role Security

**Files:**
- Create: `server/src/main/java/com/luneng/smartstore/auth/JwtService.java`
- Create: `server/src/main/java/com/luneng/smartstore/auth/SecurityConfig.java`
- Create: `server/src/main/java/com/luneng/smartstore/auth/CurrentPrincipal.java`
- Create: `server/src/main/java/com/luneng/smartstore/staff/StaffAccount.java`
- Create: `server/src/main/java/com/luneng/smartstore/staff/StaffAccountRepository.java`
- Create: `server/src/main/java/com/luneng/smartstore/staff/StaffAuthService.java`
- Create: `server/src/main/java/com/luneng/smartstore/staff/StaffAuthController.java`
- Create: `server/src/test/java/com/luneng/smartstore/staff/StaffAuthControllerTest.java`
- Create: `database/seed/001_owner_account.sql`

**Interfaces:**
- Consumes: `staff_account`, `ApiResponse`, Redis configuration.
- Produces: `POST /api/admin/auth/login`; roles `OWNER`, `CASHIER`; JWT claims `sub`, `actorType=STAFF`, `role`, `sessionId`.

- [ ] **Step 1: Write failing authentication and authorization tests**

```java
@Test
void ownerCanLoginAndReceivesOwnerRole() throws Exception {
    mockMvc.perform(post("/api/admin/auth/login")
            .contentType(APPLICATION_JSON)
            .content("""
                {"username":"owner","password":"correct-password"}
                """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.role").value("OWNER"))
        .andExpect(jsonPath("$.data.accessToken").isNotEmpty());
}

@Test
void cashierCannotCallOwnerOnlyEndpoint() throws Exception {
    mockMvc.perform(get("/api/admin/security-test/owner-only")
            .header("Authorization", "Bearer " + cashierToken))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("FORBIDDEN"));
}
```

- [ ] **Step 2: Run tests and verify failure**

Run: `cd server; .\mvnw.cmd test -Dtest=StaffAuthControllerTest`

Expected: FAIL with missing authentication endpoint and security configuration.

- [ ] **Step 3: Implement staff authentication**

Define:

```java
public record CurrentPrincipal(
    long id,
    ActorType actorType,
    String role,
    String sessionId
) {}
```

`StaffAuthService.login(String username, String rawPassword)` must:

1. load an enabled staff account;
2. verify the BCrypt password;
3. create a random `sessionId`;
4. store `auth:session:{sessionId}` in Redis with the JWT expiry;
5. return a signed JWT and role.

`SecurityConfig` must:

- allow `/actuator/health`, `/files/**`, `/api/mini/auth/wechat`, and public mini catalog reads;
- require `actorType=STAFF` for `/api/admin/**`;
- require role `OWNER` for `/api/admin/staff/**`;
- disable server sessions and CSRF for the JSON API;
- validate both JWT signature and Redis session presence.

The owner seed file must contain a documented procedure to generate a BCrypt hash; it must not contain a reusable production password.

- [ ] **Step 4: Run authentication tests**

Run: `cd server; .\mvnw.cmd test -Dtest=StaffAuthControllerTest`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add server/src/main/java/com/luneng/smartstore/auth server/src/main/java/com/luneng/smartstore/staff server/src/test/java/com/luneng/smartstore/staff database/seed/001_owner_account.sql
git commit -m "feat: secure admin access with staff roles"
```

---

### Task 4: Catalog and Online Inventory Backend

**Files:**
- Create: `server/src/main/java/com/luneng/smartstore/catalog/Category.java`
- Create: `server/src/main/java/com/luneng/smartstore/catalog/Product.java`
- Create: `server/src/main/java/com/luneng/smartstore/catalog/CatalogRepository.java`
- Create: `server/src/main/java/com/luneng/smartstore/catalog/CatalogService.java`
- Create: `server/src/main/java/com/luneng/smartstore/catalog/AdminCatalogController.java`
- Create: `server/src/main/java/com/luneng/smartstore/catalog/MiniCatalogController.java`
- Create: `server/src/main/java/com/luneng/smartstore/inventory/OnlineInventory.java`
- Create: `server/src/main/java/com/luneng/smartstore/inventory/InventoryLedger.java`
- Create: `server/src/main/java/com/luneng/smartstore/inventory/InventoryRepository.java`
- Create: `server/src/main/java/com/luneng/smartstore/inventory/InventoryService.java`
- Create: `server/src/main/java/com/luneng/smartstore/inventory/AdminInventoryController.java`
- Create: `server/src/test/java/com/luneng/smartstore/catalog/CatalogApiTest.java`
- Create: `server/src/test/java/com/luneng/smartstore/inventory/InventoryServiceTest.java`

**Interfaces:**
- Consumes: owner JWT, schema from Task 2.
- Produces: admin category/product CRUD; public category/product list/search/detail; `InventoryService.adjust(long productId, int delta, String reason, CurrentPrincipal actor)`; `InventoryService.reserve(Map<Long,Integer> quantities, String orderNo)`; `InventoryService.release(String orderNo)`.

- [ ] **Step 1: Write failing catalog and inventory tests**

```java
@Test
void miniCatalogReturnsOnlyEnabledCategoriesAndOnShelfProducts() throws Exception {
    mockMvc.perform(get("/api/mini/products").param("keyword", "牛奶"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.items[0].name").value("纯牛奶"))
        .andExpect(jsonPath("$.data.items[0].priceCent").value(590));
}

@Test
void adjustmentCreatesLedgerAndNeverAllowsNegativeStock() {
    inventoryService.adjust(productId, 10, "首批线上库存", owner);
    assertThat(inventoryService.current(productId)).isEqualTo(10);
    assertThatThrownBy(() -> inventoryService.adjust(productId, -11, "盘点", owner))
        .isInstanceOf(BusinessException.class)
        .hasMessageContaining("库存不足");
}
```

- [ ] **Step 2: Run tests and verify failure**

Run: `cd server; .\mvnw.cmd test -Dtest=CatalogApiTest,InventoryServiceTest`

Expected: FAIL because catalog and inventory modules do not exist.

- [ ] **Step 3: Implement catalog and inventory**

Admin endpoints:

```text
GET    /api/admin/categories
POST   /api/admin/categories
PUT    /api/admin/categories/{id}
GET    /api/admin/products
POST   /api/admin/products
PUT    /api/admin/products/{id}
PATCH  /api/admin/products/{id}/shelf
GET    /api/admin/inventory
POST   /api/admin/inventory/{productId}/adjustments
```

Mini endpoints:

```text
GET /api/mini/categories
GET /api/mini/products?categoryId=&keyword=&page=&size=
GET /api/mini/products/{id}
```

The product write request is:

```java
public record ProductWriteRequest(
    @NotBlank String name,
    @NotNull Long categoryId,
    @PositiveOrZero long priceCent,
    @NotBlank String unit,
    String coverImageUrl,
    String description,
    boolean onShelf
) {}
```

Inventory adjustment must update inventory and create exactly one ledger row in one transaction. Reservation must sort product IDs, use conditional atomic updates, and throw `INSUFFICIENT_STOCK` if any update count is zero so the entire transaction rolls back.

- [ ] **Step 4: Run catalog and inventory tests**

Run: `cd server; .\mvnw.cmd test -Dtest=CatalogApiTest,InventoryServiceTest`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add server/src/main/java/com/luneng/smartstore/catalog server/src/main/java/com/luneng/smartstore/inventory server/src/test/java/com/luneng/smartstore/catalog server/src/test/java/com/luneng/smartstore/inventory
git commit -m "feat: add catalog and online inventory"
```

---

### Task 5: Admin SPA Foundation, Catalog and Inventory Screens

**Files:**
- Create: `admin/package.json`
- Create: `admin/package-lock.json`
- Create: `admin/index.html`
- Create: `admin/vite.config.ts`
- Create: `admin/vitest.config.ts`
- Create: `admin/src/main.ts`
- Create: `admin/src/App.vue`
- Create: `admin/src/api/http.ts`
- Create: `admin/src/api/catalog.ts`
- Create: `admin/src/api/inventory.ts`
- Create: `admin/src/router/index.ts`
- Create: `admin/src/stores/auth.ts`
- Create: `admin/src/layouts/AdminLayout.vue`
- Create: `admin/src/views/LoginView.vue`
- Create: `admin/src/views/catalog/CategoryView.vue`
- Create: `admin/src/views/catalog/ProductView.vue`
- Create: `admin/src/views/inventory/InventoryView.vue`
- Create: `admin/tests/LoginView.spec.ts`
- Create: `admin/tests/ProductView.spec.ts`
- Create: `admin/tests/InventoryView.spec.ts`

**Interfaces:**
- Consumes: admin auth, catalog, and inventory endpoints from Tasks 3–4.
- Produces: browser routes `/login`, `/products`, `/categories`, `/inventory`; typed `request<T>(path, options): Promise<T>`.

- [ ] **Step 1: Write failing view tests**

```ts
it('blocks submission until username and password are present', async () => {
  const wrapper = mount(LoginView, { global: testPlugins() })
  await wrapper.get('[data-test="login-submit"]').trigger('click')
  expect(wrapper.text()).toContain('请输入用户名')
  expect(wrapper.text()).toContain('请输入密码')
})
```

```ts
it('submits stock adjustment in whole units', async () => {
  const wrapper = mount(InventoryView, { global: testPlugins() })
  await wrapper.get('[data-test="adjust-1"]').trigger('click')
  await wrapper.get('[data-test="adjust-delta"]').setValue('5')
  await wrapper.get('[data-test="adjust-reason"]').setValue('首批线上库存')
  await wrapper.get('[data-test="adjust-submit"]').trigger('click')
  expect(inventoryApi.adjust).toHaveBeenCalledWith(1, {
    delta: 5,
    reason: '首批线上库存',
  })
})
```

- [ ] **Step 2: Run tests and verify failure**

Run: `cd admin; npm test -- --run`

Expected: FAIL because the Vue application and views do not exist.

- [ ] **Step 3: Implement the admin foundation**

Use Vue 3 Composition API with `<script setup lang="ts">`, Vue Router, Pinia, Element Plus, Vitest, Vue Test Utils, ESLint and Prettier.

`http.ts` must:

- prefix requests with `VITE_API_BASE_URL`;
- attach `Authorization: Bearer {token}`;
- parse `ApiResponse<T>`;
- clear auth and redirect to `/login` on 401;
- show the server `message` for business errors.

Product forms use `FormRules` and integer `priceCent`; the UI may show yuan but converts with tested helpers:

```ts
export const centToYuan = (cent: number): string => (cent / 100).toFixed(2)
export const yuanToCent = (yuan: string): number => {
  if (!/^\d+(\.\d{1,2})?$/.test(yuan)) throw new Error('金额格式错误')
  return Math.round(Number(yuan) * 100)
}
```

The layout must hide category, product, and inventory routes for `CASHIER`, and the router guard must reject direct navigation to those routes.

- [ ] **Step 4: Run admin tests and production build**

Run: `cd admin; npm test -- --run`

Expected: PASS.

Run: `cd admin; npm run build`

Expected: exit code 0 and `admin/dist` created.

- [ ] **Step 5: Commit**

```powershell
git add admin
git commit -m "feat: add admin catalog and inventory screens"
```

---

### Task 6: Customer WeChat Authentication and Public Storefront API

**Files:**
- Create: `server/src/main/java/com/luneng/smartstore/customer/CustomerUser.java`
- Create: `server/src/main/java/com/luneng/smartstore/customer/CustomerUserRepository.java`
- Create: `server/src/main/java/com/luneng/smartstore/customer/WechatSessionClient.java`
- Create: `server/src/main/java/com/luneng/smartstore/customer/CustomerAuthService.java`
- Create: `server/src/main/java/com/luneng/smartstore/customer/CustomerAuthController.java`
- Create: `server/src/main/java/com/luneng/smartstore/customer/CustomerProfileController.java`
- Create: `server/src/test/java/com/luneng/smartstore/customer/CustomerAuthControllerTest.java`

**Interfaces:**
- Consumes: JWT infrastructure, customer table, WeChat `code` supplied by `wx.login`.
- Produces: `POST /api/mini/auth/wechat`; `GET /api/mini/profile`; `PUT /api/mini/profile`; JWT claims `actorType=CUSTOMER`, `sub`, `sessionId`.

- [ ] **Step 1: Write failing customer login tests**

```java
@Test
void wechatCodeCreatesCustomerAndReturnsCustomerToken() throws Exception {
    when(wechatSessionClient.exchange("valid-code"))
        .thenReturn(new WechatSession("openid-123", "session-key"));

    mockMvc.perform(post("/api/mini/auth/wechat")
            .contentType(APPLICATION_JSON)
            .content("""{"code":"valid-code"}"""))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.accessToken").isNotEmpty())
        .andExpect(jsonPath("$.data.profileComplete").value(false));
}

@Test
void customerCannotUseAdminTokenOnProfileEndpoint() throws Exception {
    mockMvc.perform(get("/api/mini/profile")
            .header("Authorization", "Bearer " + ownerToken))
        .andExpect(status().isForbidden());
}
```

- [ ] **Step 2: Run tests and verify failure**

Run: `cd server; .\mvnw.cmd test -Dtest=CustomerAuthControllerTest`

Expected: FAIL because customer authentication classes do not exist.

- [ ] **Step 3: Implement customer authentication**

`WechatSessionClient` must exchange the one-time code on the server and never return or persist the WeChat `session_key` in API responses or logs.

Profile update request:

```java
public record CustomerProfileRequest(
    @NotBlank @Size(max = 40) String pickupName,
    @NotBlank @Pattern(regexp = "^1\\d{10}$") String phone
) {}
```

Customer JWT validation must require an active Redis session and `actorType=CUSTOMER`. Public catalog reads stay anonymous; profile and all order endpoints require customer authentication.

- [ ] **Step 4: Run customer authentication tests**

Run: `cd server; .\mvnw.cmd test -Dtest=CustomerAuthControllerTest`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add server/src/main/java/com/luneng/smartstore/customer server/src/test/java/com/luneng/smartstore/customer
git commit -m "feat: add WeChat customer authentication"
```

---

### Task 7: Native Mini Program Storefront and Local Cart

**Files:**
- Create: `mini/package.json`
- Create: `mini/package-lock.json`
- Create: `mini/project.config.json`
- Create: `mini/tsconfig.json`
- Create: `mini/miniprogram/app.ts`
- Create: `mini/miniprogram/app.json`
- Create: `mini/miniprogram/config/env.ts`
- Create: `mini/miniprogram/services/http.ts`
- Create: `mini/miniprogram/services/catalog.ts`
- Create: `mini/miniprogram/store/cart.ts`
- Create: `mini/miniprogram/types/catalog.ts`
- Create: `mini/miniprogram/pages/home/index.ts`
- Create: `mini/miniprogram/pages/home/index.wxml`
- Create: `mini/miniprogram/pages/home/index.wxss`
- Create: `mini/miniprogram/pages/product/index.ts`
- Create: `mini/miniprogram/pages/product/index.wxml`
- Create: `mini/miniprogram/pages/cart/index.ts`
- Create: `mini/miniprogram/pages/cart/index.wxml`
- Create: `mini/tests/cart.spec.ts`
- Create: `mini/tests/catalog.spec.ts`

**Interfaces:**
- Consumes: public mini catalog endpoints from Task 4.
- Produces: `CartItem { productId, name, coverImageUrl, unitPriceCent, quantity, selected }`; local-storage key `smart-store-cart-v1`; home, product detail, and cart pages.

- [ ] **Step 1: Write failing cart tests**

```ts
it('merges the same product and calculates selected total in cents', () => {
  const cart = createCart(memoryStorage())
  cart.add({ productId: 1, name: '纯牛奶', unitPriceCent: 590, coverImageUrl: '' })
  cart.add({ productId: 1, name: '纯牛奶', unitPriceCent: 590, coverImageUrl: '' })
  expect(cart.items()).toEqual([
    expect.objectContaining({ productId: 1, quantity: 2, selected: true }),
  ])
  expect(cart.selectedTotalCent()).toBe(1180)
})

it('never allows quantity below one', () => {
  const cart = createCart(memoryStorage())
  cart.add({ productId: 1, name: '纯牛奶', unitPriceCent: 590, coverImageUrl: '' })
  expect(() => cart.setQuantity(1, 0)).toThrow('商品数量至少为 1')
})
```

- [ ] **Step 2: Run tests and verify failure**

Run: `cd mini; npm test -- --run`

Expected: FAIL because the mini-program modules do not exist.

- [ ] **Step 3: Implement storefront and cart**

Use native WXML/WXSS and TypeScript page files with TDesign MiniProgram primitives and TDesign Icons. Map component theme variables to the confirmed deep-crimson visual tokens. Use TDesign for generic controls such as buttons, search, tabs, grid, stepper, popup, dialog, toast, skeleton and tab bar; implement the home business cards, product cards, category entrances and recommendation sections as project-specific components. Do not mix Vant Weapp or WeUI, and do not copy the visual styling of a TDesign retail starter. `http.ts` wraps `wx.request`, reads `apiBaseUrl` from an environment-specific config module, and converts the backend envelope into resolved data or a displayed Chinese error.

The home page must support:

- enabled category navigation;
- keyword search;
- paginated on-shelf product list;
- empty, loading, retry, and end-of-list states.

The cart must:

- persist after application restart;
- merge repeated products;
- clamp quantity to positive integers;
- allow selecting and removing items;
- calculate totals only from selected items;
- treat displayed price as advisory because the backend revalidates it at checkout.

- [ ] **Step 4: Run mini-program unit tests**

Run: `cd mini; npm test -- --run`

Expected: PASS.

Open `mini/project.config.json` in WeChat Developer Tools and compile.

Expected: home, detail, and cart pages compile without TypeScript, WXML, or WXSS errors.

- [ ] **Step 5: Commit**

```powershell
git add mini
git commit -m "feat: add mini program storefront and cart"
```

---

### Task 8: Transactional Order Creation, Cancellation and Query APIs

**Files:**
- Create: `server/src/main/java/com/luneng/smartstore/order/OrderStatus.java`
- Create: `server/src/main/java/com/luneng/smartstore/order/PaymentStatus.java`
- Create: `server/src/main/java/com/luneng/smartstore/order/PaymentMethod.java`
- Create: `server/src/main/java/com/luneng/smartstore/order/CustomerOrder.java`
- Create: `server/src/main/java/com/luneng/smartstore/order/OrderItem.java`
- Create: `server/src/main/java/com/luneng/smartstore/order/OrderStatusHistory.java`
- Create: `server/src/main/java/com/luneng/smartstore/order/OrderRepository.java`
- Create: `server/src/main/java/com/luneng/smartstore/order/OrderNumberGenerator.java`
- Create: `server/src/main/java/com/luneng/smartstore/order/OrderApplicationService.java`
- Create: `server/src/main/java/com/luneng/smartstore/order/MiniOrderController.java`
- Create: `server/src/test/java/com/luneng/smartstore/order/OrderApplicationServiceTest.java`
- Create: `server/src/test/java/com/luneng/smartstore/order/OrderConcurrencyTest.java`
- Create: `server/src/test/java/com/luneng/smartstore/order/MiniOrderControllerTest.java`

**Interfaces:**
- Consumes: customer identity, catalog snapshots, `InventoryService.reserve` and `release`.
- Produces: mini create/list/detail/cancel endpoints; states `PENDING_CONFIRMATION`, `PREPARING`, `READY_FOR_PICKUP`, `COMPLETED`, `CANCELLED`; payments `UNPAID`, `PAID`.

- [ ] **Step 1: Write failing order tests**

```java
@Test
void createOrderUsesServerPriceAndReservesStockAtomically() {
    var command = new CreateOrderCommand(
        customerId, "req-001", "李先生", "13800138000",
        List.of(new CreateOrderItem(productId, 2))
    );
    var result = service.create(command);
    assertThat(result.totalCent()).isEqualTo(1180);
    assertThat(result.status()).isEqualTo(PENDING_CONFIRMATION);
    assertThat(inventoryService.current(productId)).isEqualTo(8);
}

@Test
void duplicateIdempotencyKeyReturnsOriginalOrder() {
    var first = service.create(command);
    var second = service.create(command);
    assertThat(second.orderNo()).isEqualTo(first.orderNo());
    assertThat(orderRepository.count()).isEqualTo(1);
}

@Test
void customerCancellationReleasesStockExactlyOnce() {
    var order = service.create(command);
    service.cancelByCustomer(customerId, order.orderNo());
    assertThat(inventoryService.current(productId)).isEqualTo(10);
    assertThatThrownBy(() -> service.cancelByCustomer(customerId, order.orderNo()))
        .isInstanceOf(BusinessException.class);
    assertThat(inventoryService.current(productId)).isEqualTo(10);
}
```

- [ ] **Step 2: Run tests and verify failure**

Run: `cd server; .\mvnw.cmd test -Dtest=OrderApplicationServiceTest,OrderConcurrencyTest,MiniOrderControllerTest`

Expected: FAIL because order classes and APIs do not exist.

- [ ] **Step 3: Implement order creation and customer operations**

Create request:

```java
public record CreateOrderRequest(
    @NotBlank @Size(max = 40) String pickupName,
    @NotBlank @Pattern(regexp = "^1\\d{10}$") String phone,
    @NotEmpty List<@Valid Item> items
) {
    public record Item(@NotNull Long productId, @Min(1) int quantity) {}
}
```

Endpoints:

```text
POST /api/mini/orders                  Header: Idempotency-Key
GET  /api/mini/orders?page=&size=
GET  /api/mini/orders/{orderNo}
POST /api/mini/orders/{orderNo}/cancel
```

`OrderApplicationService.create` must:

1. return the existing order for the same customer and idempotency key;
2. merge duplicate product IDs and reject empty or excessive quantities;
3. load all products and reject missing or off-shelf products;
4. calculate totals from server-side prices with exact integer arithmetic;
5. reserve stock in ascending product ID order;
6. save order, immutable item snapshots, initial history, ledgers, and idempotency record in one transaction.

Customer cancellation is allowed only from `PENDING_CONFIRMATION`; it changes status, creates history, and releases inventory in one transaction.

- [ ] **Step 4: Verify transactional and concurrent behavior**

Run: `cd server; .\mvnw.cmd test -Dtest=OrderApplicationServiceTest,OrderConcurrencyTest,MiniOrderControllerTest`

Expected: PASS, including two concurrent requests for one remaining unit producing exactly one successful order and inventory `0`.

- [ ] **Step 5: Commit**

```powershell
git add server/src/main/java/com/luneng/smartstore/order server/src/test/java/com/luneng/smartstore/order
git commit -m "feat: add transactional customer orders"
```

---

### Task 9: Mini Program Login, Checkout and Order Pages

**Files:**
- Create: `mini/miniprogram/services/auth.ts`
- Create: `mini/miniprogram/services/orders.ts`
- Create: `mini/miniprogram/store/session.ts`
- Create: `mini/miniprogram/types/order.ts`
- Create: `mini/miniprogram/pages/checkout/index.ts`
- Create: `mini/miniprogram/pages/checkout/index.wxml`
- Create: `mini/miniprogram/pages/orders/index.ts`
- Create: `mini/miniprogram/pages/orders/index.wxml`
- Create: `mini/miniprogram/pages/order-detail/index.ts`
- Create: `mini/miniprogram/pages/order-detail/index.wxml`
- Create: `mini/tests/checkout.spec.ts`
- Create: `mini/tests/order-status.spec.ts`

**Interfaces:**
- Consumes: customer auth/profile endpoints from Task 6 and order endpoints from Task 8.
- Produces: login-on-checkout, contact profile form, idempotent order submission, order list/detail/cancel user experience.

- [ ] **Step 1: Write failing checkout and status tests**

```ts
it('logs in, saves contact data, and submits selected cart items once', async () => {
  const result = await checkout.submit()
  expect(auth.loginWithWechat).toHaveBeenCalledTimes(1)
  expect(profile.save).toHaveBeenCalledWith({
    pickupName: '李先生',
    phone: '13800138000',
  })
  expect(orders.create).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({
      items: [{ productId: 1, quantity: 2 }],
    }),
  )
  expect(result.orderNo).toBe('202607280001')
})

it('allows customer cancellation only while pending confirmation', () => {
  expect(canCustomerCancel('PENDING_CONFIRMATION')).toBe(true)
  expect(canCustomerCancel('PREPARING')).toBe(false)
  expect(canCustomerCancel('READY_FOR_PICKUP')).toBe(false)
})
```

- [ ] **Step 2: Run tests and verify failure**

Run: `cd mini; npm test -- --run`

Expected: FAIL because checkout, auth, and order modules do not exist.

- [ ] **Step 3: Implement checkout and orders**

Checkout sequence:

1. ensure at least one cart item is selected;
2. call `wx.login`;
3. exchange code for customer token if no valid local session exists;
4. require and validate pickup name plus `^1\d{10}$` phone;
5. save profile;
6. generate a UUID idempotency key and retain it until a definitive response;
7. submit selected items;
8. on success remove only purchased items and navigate to order detail;
9. on network uncertainty query orders before allowing another submission.

Display Chinese status labels:

```ts
export const orderStatusLabel: Record<OrderStatus, string> = {
  PENDING_CONFIRMATION: '待门店确认',
  PREPARING: '备货中',
  READY_FOR_PICKUP: '待取货',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
}
```

The order detail page shows item snapshots, total, payment status, pickup contact, cancellation reason, and status history. Show the cancel button only for `PENDING_CONFIRMATION`.

- [ ] **Step 4: Run tests and compile in Developer Tools**

Run: `cd mini; npm test -- --run`

Expected: PASS.

Compile and exercise login, checkout, list, detail, and cancellation in WeChat Developer Tools.

Expected: no compile errors; uncertain network state does not create a second order.

- [ ] **Step 5: Commit**

```powershell
git add mini/miniprogram mini/tests
git commit -m "feat: add mini program checkout and orders"
```

---

### Task 10: Admin Order Workflow, Staff Management and Audit

**Files:**
- Create: `server/src/main/java/com/luneng/smartstore/order/AdminOrderController.java`
- Create: `server/src/main/java/com/luneng/smartstore/order/AdminOrderService.java`
- Create: `server/src/main/java/com/luneng/smartstore/staff/StaffManagementController.java`
- Create: `server/src/main/java/com/luneng/smartstore/staff/StaffManagementService.java`
- Create: `server/src/main/java/com/luneng/smartstore/audit/OperationLog.java`
- Create: `server/src/main/java/com/luneng/smartstore/audit/AuditService.java`
- Create: `server/src/main/java/com/luneng/smartstore/audit/AdminAuditController.java`
- Modify: `server/src/main/java/com/luneng/smartstore/catalog/CatalogService.java`
- Modify: `server/src/main/java/com/luneng/smartstore/inventory/InventoryService.java`
- Create: `server/src/test/java/com/luneng/smartstore/order/AdminOrderWorkflowTest.java`
- Create: `server/src/test/java/com/luneng/smartstore/staff/StaffManagementTest.java`
- Create: `server/src/test/java/com/luneng/smartstore/audit/AdminAuditControllerTest.java`
- Create: `admin/src/api/orders.ts`
- Create: `admin/src/api/staff.ts`
- Create: `admin/src/api/audit.ts`
- Create: `admin/src/views/orders/OrderListView.vue`
- Create: `admin/src/views/orders/OrderDetailView.vue`
- Create: `admin/src/views/staff/StaffView.vue`
- Create: `admin/src/views/audit/AuditLogView.vue`
- Create: `admin/tests/OrderWorkflow.spec.ts`
- Create: `admin/tests/StaffView.spec.ts`
- Create: `admin/tests/AuditLogView.spec.ts`

**Interfaces:**
- Consumes: staff roles and order state from Tasks 3 and 8.
- Produces: admin order accept/reject/ready/pay/complete/cancel; owner-only cashier management; operation logs for all critical mutations.

- [ ] **Step 1: Write failing workflow and role tests**

```java
@Test
void validWorkflowRequiresPaymentBeforeCompletion() {
    adminOrders.accept(orderNo, cashier);
    adminOrders.markReady(orderNo, cashier);
    assertThatThrownBy(() -> adminOrders.complete(orderNo, cashier))
        .isInstanceOf(BusinessException.class)
        .hasMessageContaining("未付款");
    adminOrders.markPaid(orderNo, PaymentMethod.WECHAT_QR, cashier);
    adminOrders.complete(orderNo, cashier);
    assertThat(orderRepository.findByOrderNo(orderNo).orElseThrow().getStatus())
        .isEqualTo(COMPLETED);
}

@Test
void cashierCannotCreateAnotherCashier() {
    assertThatThrownBy(() -> staffManagement.createCashier(request, cashier))
        .isInstanceOf(AccessDeniedException.class);
}
```

- [ ] **Step 2: Run backend and admin tests and verify failure**

Run: `cd server; .\mvnw.cmd test -Dtest=AdminOrderWorkflowTest,StaffManagementTest,AdminAuditControllerTest`

Expected: FAIL because workflow and staff management do not exist.

Run: `cd admin; npm test -- --run OrderWorkflow StaffView`

Expected: FAIL because order and staff screens do not exist.

- [ ] **Step 3: Implement backend workflow**

Endpoints:

```text
GET  /api/admin/orders?status=&paymentStatus=&keyword=&page=&size=
GET  /api/admin/orders/{orderNo}
POST /api/admin/orders/{orderNo}/accept
POST /api/admin/orders/{orderNo}/reject
POST /api/admin/orders/{orderNo}/ready
POST /api/admin/orders/{orderNo}/pay
POST /api/admin/orders/{orderNo}/complete
POST /api/admin/orders/{orderNo}/cancel
GET  /api/admin/staff
POST /api/admin/staff
PATCH /api/admin/staff/{id}/enabled
POST /api/admin/staff/{id}/reset-password
GET  /api/admin/audit-logs?actorId=&action=&objectType=&page=&size=
```

Allowed transitions:

```text
PENDING_CONFIRMATION -> PREPARING
PENDING_CONFIRMATION -> CANCELLED
PREPARING            -> READY_FOR_PICKUP
PREPARING            -> CANCELLED
READY_FOR_PICKUP     -> COMPLETED only when paymentStatus=PAID
READY_FOR_PICKUP     -> CANCELLED
```

Reject and cancel require a nonblank reason. Pay requires `CASH` or `WECHAT_QR`. Every successful transition creates a status history row and operation log. Cancellation and inventory release occur in one transaction. Staff passwords are BCrypt hashes; only the owner can create, disable, or reset cashier accounts.

Add audit calls to catalog and inventory mutations from Task 4. The owner-only audit endpoint returns actor, action, object type, object ID, result summary, request ID, and timestamp; it never returns password hashes, JWTs, WeChat session keys, or environment secrets.

- [ ] **Step 4: Implement admin screens**

Order list filters by order status, payment status, order number, pickup name, or phone. Order detail shows status history and only the actions valid for the current state.

Every mutation dialog:

- names the order and next state;
- requires a reason where applicable;
- disables submit while pending;
- refreshes detail after success;
- displays server conflict messages without optimistic state corruption.

The staff page is owner-only and supports cashier creation, enable/disable, and password reset. It never displays stored password hashes. The audit page is owner-only and supports filtering by operator, action, and business object.

- [ ] **Step 5: Run backend, admin, and build checks**

Run: `cd server; .\mvnw.cmd test -Dtest=AdminOrderWorkflowTest,StaffManagementTest,AdminAuditControllerTest`

Expected: PASS.

Run: `cd admin; npm test -- --run`

Expected: PASS.

Run: `cd admin; npm run build`

Expected: exit code 0.

- [ ] **Step 6: Commit**

```powershell
git add server/src/main/java/com/luneng/smartstore/order server/src/main/java/com/luneng/smartstore/staff server/src/main/java/com/luneng/smartstore/audit server/src/test/java/com/luneng/smartstore/order server/src/test/java/com/luneng/smartstore/staff admin
git commit -m "feat: add store order workflow and staff management"
```

---

### Task 11: Product Images, Rate Limits and Security Hardening

**Files:**
- Create: `server/src/main/java/com/luneng/smartstore/file/ImageStorageService.java`
- Create: `server/src/main/java/com/luneng/smartstore/file/AdminImageController.java`
- Create: `server/src/main/java/com/luneng/smartstore/file/PublicImageController.java`
- Create: `server/src/main/java/com/luneng/smartstore/common/web/RateLimitFilter.java`
- Create: `server/src/test/java/com/luneng/smartstore/file/ImageUploadTest.java`
- Create: `server/src/test/java/com/luneng/smartstore/common/web/RateLimitFilterTest.java`
- Modify: `admin/src/views/catalog/ProductView.vue`
- Modify: `server/src/main/java/com/luneng/smartstore/auth/SecurityConfig.java`

**Interfaces:**
- Consumes: owner product editor; `UPLOAD_DIR`; Redis.
- Produces: `POST /api/admin/files/images`; `GET /files/{generatedName}`; rate-limit keys for login and order creation.

- [ ] **Step 1: Write failing upload and rate-limit tests**

```java
@Test
void rejectsExecutableDisguisedAsImage() throws Exception {
    var file = new MockMultipartFile(
        "file", "bad.jpg", "image/jpeg", "MZ executable".getBytes(UTF_8)
    );
    mockMvc.perform(multipart("/api/admin/files/images")
            .file(file)
            .header("Authorization", "Bearer " + ownerToken))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_IMAGE"));
}

@Test
void orderRateLimitReturnsTooManyRequests() throws Exception {
    for (int i = 0; i < allowedRequests; i++) {
        performCreateOrder(customerToken, "key-" + i).andExpect(status().isOk());
    }
    performCreateOrder(customerToken, "key-over-limit")
        .andExpect(status().isTooManyRequests())
        .andExpect(jsonPath("$.code").value("RATE_LIMITED"));
}
```

- [ ] **Step 2: Run tests and verify failure**

Run: `cd server; .\mvnw.cmd test -Dtest=ImageUploadTest,RateLimitFilterTest`

Expected: FAIL because upload validation and rate limiting do not exist.

- [ ] **Step 3: Implement secure image storage**

Allow JPEG, PNG, and WebP only. Enforce a 5 MiB maximum, decode image bytes to verify actual image content, generate a UUID filename, normalize the destination path, and reject any resolved path outside `UPLOAD_DIR`. Never use the original filename for storage.

The upload response is:

```java
public record ImageUploadResponse(
    String url,
    int width,
    int height,
    long size
) {}
```

Integrate Element Plus upload with the authenticated admin endpoint and write the returned URL into the product form.

- [ ] **Step 4: Implement Redis-backed limits**

Use fixed-window counters with explicit configuration:

- staff login: 10 attempts per IP per 10 minutes;
- customer login: 30 attempts per IP per 10 minutes;
- order creation: 10 attempts per customer per minute.

Return HTTP 429 with code `RATE_LIMITED`. Rate-limit failure must fail closed only for login; if Redis is temporarily unavailable, authenticated order creation continues and logs a warning because MySQL idempotency still prevents duplicates.

- [ ] **Step 5: Run security tests and full builds**

Run: `cd server; .\mvnw.cmd test`

Expected: PASS.

Run: `cd admin; npm test -- --run; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; npm run build`

Expected: tests PASS and build exits 0.

Run: `cd mini; npm test -- --run`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add server admin
git commit -m "feat: secure image uploads and sensitive endpoints"
```

---

### Task 12: End-to-End Verification, Deployment and Trial Operations

**Files:**
- Create: `server/src/test/java/com/luneng/smartstore/e2e/OrderLifecycleE2ETest.java`
- Create: `database/seed/010_trial_catalog.sql`
- Create: `deploy/compose.production.yaml`
- Create: `deploy/env.example`
- Create: `deploy/nginx/smart-store.conf`
- Create: `docs/api/mvp-api.md`
- Create: `docs/operations/deployment.md`
- Create: `docs/operations/backup-and-restore.md`
- Create: `docs/operations/trial-acceptance.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: all previous tasks.
- Produces: reproducible production deployment, backup/restore runbook, API reference, seed catalog procedure, and signed trial checklist.

- [ ] **Step 1: Write the failing full-lifecycle test**

```java
@Test
void customerOrderCompletesWithConsistentMoneyPaymentAndInventory() {
    var order = customerCreatesOrder(productId, 2, "life-001");
    staffAccepts(order.orderNo(), cashierToken);
    staffMarksReady(order.orderNo(), cashierToken);
    staffMarksPaid(order.orderNo(), "WECHAT_QR", cashierToken);
    staffCompletes(order.orderNo(), cashierToken);

    var stored = orderRepository.findByOrderNo(order.orderNo()).orElseThrow();
    assertThat(stored.getStatus()).isEqualTo(COMPLETED);
    assertThat(stored.getPaymentStatus()).isEqualTo(PAID);
    assertThat(stored.getTotalCent()).isEqualTo(1180);
    assertThat(inventoryService.current(productId)).isEqualTo(8);
    assertThat(inventoryLedgerRepository.sumForOrder(order.orderNo())).isEqualTo(-2);
}
```

- [ ] **Step 2: Run the lifecycle test and resolve every integration gap**

Run: `cd server; .\mvnw.cmd test -Dtest=OrderLifecycleE2ETest`

Expected before final wiring: FAIL at the first incomplete integration boundary.

Make only the wiring, configuration, or defect corrections required for the test to exercise existing behavior; do not add new MVP scope.

- [ ] **Step 3: Create deployment artifacts**

`deploy/compose.production.yaml` must run:

- Spring Boot application;
- MySQL 8 with persistent volume;
- Redis with persistent volume;
- Nginx serving `admin/dist`, proxying `/api/`, and serving `/files/`;
- a persistent image volume mounted at `UPLOAD_DIR`.

`deploy/env.example` must list every required environment variable with descriptive non-secret sample values. It must not contain a valid JWT key, database password, WeChat secret, or production domain.

Nginx must:

- redirect HTTP to HTTPS;
- set upload limit to 5 MiB;
- forward request ID and client IP;
- deny access to hidden files and internal directories;
- cache versioned admin assets but not API responses.

- [ ] **Step 4: Write operational documentation**

`mvp-api.md` documents every endpoint, role, request, response, error code, order state, payment state and idempotency rule.

`deployment.md` documents first deployment, environment configuration, Flyway migration, owner account initialization, HTTPS, health check, rollback, and log locations.

`backup-and-restore.md` gives exact MySQL dump/restore and image archive/restore commands and requires a restoration rehearsal before trial launch.

`trial-acceptance.md` contains checkboxes for:

- 不少于 30 个真实商品及对应线上库存；
- one owner and at least one cashier;
- 不少于 5 位顾客完成微信登录；
- 不少于 10 笔真实或试运营订单完成完整闭环；
- money, payment, order history and inventory ledger reconciliation;
- owner/cashier permission isolation;
- concurrent low-stock order verification;
- single inventory restoration on cancellation;
- no trial-blocking severity-one defect.

- [ ] **Step 5: Run the complete verification suite**

Run: `docker compose config`

Expected: exit code 0.

Run: `cd server; .\mvnw.cmd clean verify`

Expected: all unit, integration, concurrency, security, and E2E tests PASS.

Run: `cd admin; npm ci; npm test -- --run; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; npm run build`

Expected: tests PASS and production build exits 0.

Run: `cd mini; npm ci; npm test -- --run`

Expected: PASS; then compile the project once in WeChat Developer Tools with no errors.

Run: `docker compose -f deploy/compose.production.yaml --env-file deploy/env.example config`

Expected: exit code 0 with no undefined required variables.

- [ ] **Step 6: Rehearse backup and restore**

Create a disposable trial database and disposable image directory. Follow `backup-and-restore.md` exactly, restore both into fresh targets, and verify:

```sql
select count(*) from customer_order;
select count(*) from order_item;
select count(*) from inventory_ledger;
```

Expected: source and restored counts match, and every product image referenced by an on-shelf product is readable.

- [ ] **Step 7: Commit**

```powershell
git add server/src/test/java/com/luneng/smartstore/e2e database deploy docs README.md
git commit -m "docs: add deployment and trial acceptance runbooks"
```

---

## 2. Final Acceptance Gate

Implementation is ready for trial only when all conditions below are evidenced in command output or the signed trial checklist:

- `server`: `.\mvnw.cmd clean verify` exits 0.
- `admin`: unit tests and `npm run build` exit 0.
- `mini`: unit tests pass and WeChat Developer Tools compilation has no error.
- Development and production Compose configurations validate.
- The complete order lifecycle passes with consistent amount, payment state and inventory.
- Concurrent low-stock tests prove inventory never becomes negative.
- Cancellation tests prove inventory is restored exactly once.
- Owner and cashier authorization tests pass at API and UI levels.
- Backup and restore rehearsal succeeds.
- Trial acceptance checklist meets the agreed product, user and order counts.
