# 订单备注终审修复报告

## 基线与范围

- 终审前 HEAD：`0b819d8 feat: show customer notes in order details`
- 治理规则：先 `trim`，再按有效长度限制最多 100 个字符；纯空格为空备注。
- 本波次仅处理终审 findings，没有增加备注编辑、富文本或列表展示能力。

## 根因

1. `createCheckout` 的 `customerNote` 是闭包草稿。成功路径只清除了持久化 pending request，没有清除闭包草稿，所以同一 checkout 实例的下一张订单会复用旧备注。
2. 页面输入与 store 都先执行 `slice(0, 100)`，导致外侧空格占用配额并提前丢失有效字符；101 个有效字符也可能被截断后错误放行。
3. 服务端已有“同客户 + 同幂等键直接返回已存订单”的正确分支，但原测试两次使用同一 command，未证明重试 payload 的备注变化不会覆盖首次备注。

## TDD 证据

### mini RED

先只增加测试，再运行：

```text
npm test -- checkout.spec.ts checkout-note-page.spec.ts order-note-ui.spec.ts --run
Test Files 3 failed (3)
Tests 7 failed | 8 passed (15)
```

7 个预期失败分别证明：

- 同一 checkout 实例连续两单时第二单复用了第一单备注；
- “外侧空格 + 100 有效字符”被截成 98 个有效字符；
- trim 后 101 字被错误放行；
- checkout 新页面没有初始化草稿的生命周期钩子；
- 页面没有保留 raw 草稿，也没有按 trim 后长度计数/显示 101 字错误；
- WXML 仍使用 `maxlength="100"`。

### mini GREEN

最小实现后运行：

```text
npm test -- checkout.spec.ts checkout-note-page.spec.ts order-note-ui.spec.ts --run
Test Files 3 passed (3)
Tests 15 passed (15)
```

随后把 uncertain retry 的新草稿加强为 101 字，证明 pending request 仍冻结首次备注：

```text
npm test -- checkout.spec.ts --run
Test Files 1 passed (1)
Tests 9 passed (9)
```

### 服务端幂等测试

`duplicateIdempotencyKeyReturnsOriginalOrder` 现使用同一幂等键先提交“备注 A”，再提交“备注 B”，并断言：

- 两次响应订单号相同；
- 两次响应备注均为 A；
- 数据库 `customer_note` 仍为 A；
- 仓储中只有一张订单。

运行 `OrderApplicationServiceTest` 时，测试源码已成功编译，但 Testcontainers 被本机环境阻断。首次发现 PATH 中 `WindowsApps` 与 `C:\Program Files\Git\cmd` 缺少分号；仅在 Maven 子进程修正后再次运行，得到明确阻断：`Could not find a valid Docker environment`。因此没有伪报服务端运行级 GREEN，也无法在本机执行该测试的 mutation RED。

## 实现

- `mini/miniprogram/store/checkout.ts`
  - 草稿保留原始输入，不再截断；仅在构造全新 request 时 trim 并校验 100 字。
  - pending request 存在时不重新校验或改写草稿，重试继续使用冻结 request。
  - 订单成功后清空闭包草稿。
- `mini/miniprogram/pages/checkout/index.ts`
  - 新页面 `onLoad` 将页面和 store 草稿同步为空。
  - 以 `value.trim().length` 计数，保留 raw 输入，并为 101+ 有效字符显示明确错误。
- `mini/miniprogram/pages/checkout/index.wxml`
  - 改为 `maxlength="-1"`，不再按 raw 长度截断。
  - 显示备注错误，并在有效长度超过 100 时禁用提交。
- `server/src/test/java/com/luneng/smartstore/order/OrderApplicationServiceTest.java`
  - 加强 A→B 幂等重试断言。
- `admin/tests/OrderWorkflow.spec.ts`、`mini/tests/order-note-ui.spec.ts`
  - 覆盖空备注不渲染、列表不展示备注、备注按纯文本渲染且无富文本入口。

## 变更文件

- `mini/miniprogram/store/checkout.ts`
- `mini/miniprogram/pages/checkout/index.ts`
- `mini/miniprogram/pages/checkout/index.wxml`
- `mini/tests/checkout.spec.ts`
- `mini/tests/checkout-note-page.spec.ts`
- `mini/tests/order-note-ui.spec.ts`
- `server/src/test/java/com/luneng/smartstore/order/OrderApplicationServiceTest.java`
- `admin/tests/OrderWorkflow.spec.ts`
- `.superpowers/sdd/2026-08-01-order-customer-note/final-fix-report.md`

## 最终验证

```text
mini: npm test -- --run
34 files passed, 117 tests passed

mini: npm run typecheck
exit 0

admin: npm test -- --run
13 files passed, 56 tests passed

admin: npm run build
vue-tsc + vite build, exit 0

server: .\mvnw.cmd -DskipTests package
BUILD SUCCESS；main/test compile、jar、Spring Boot repackage 均成功

server: .\mvnw.cmd -Dtest=OrderApplicationServiceTest test
BLOCKED：本机无可用 Docker/Testcontainers 环境
```

## Findings 对照与自审

1. 成功后闭包草稿清零；新页面初始化同步空白；连续两单回归测试覆盖第二单无备注。
2. 页面和 store 都不再 raw 截断；100 有效字符可提交，101 有效字符被阻止并显示错误；纯空格 trim 后省略；pending retry 冻结测试使用 101 字新草稿仍返回首次备注。
3. 服务端幂等测试覆盖 A→B、响应/数据库仍为 A、订单数为 1；运行被 Docker 阻断，但测试编译和 package 成功。
4. mini/admin 覆盖空备注不渲染、列表不展示、纯文本渲染；生产详情模板没有 `rich-text` 或 `v-html`。

自审未发现备注写接口、列表展示、富文本渲染或 pending request 改写。唯一 concern 是本机 Docker 不可用，服务端集成测试需在有 Docker 的 CI/开发机运行。
