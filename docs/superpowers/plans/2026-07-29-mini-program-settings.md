# 小程序“设置”页面 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将退出登录和账号注销集中到独立设置页，同时提供协议、隐私政策和精准的本地使用记录清理能力，默认取货信息继续保留在“我的”页。

**Architecture:** 新建独立 `pages/settings` 页面，并将纯交互决策放在页面级 `presentation.ts` 中便于单元测试。新增本地使用记录清理模块，只清除购物车、搜索记录和待提交订单；设置页复用现有会话、账号注销服务和法律文档页面，不新增后端接口。

**Tech Stack:** 微信原生小程序、TypeScript 5.9、TDesign Miniprogram 1.15.3、Vitest 4.1.6

## Global Constraints

- 默认取货姓名和手机号仍只在“我的”页面查看和编辑。
- “设置”入口对登录和未登录用户都可见。
- 清除本地使用记录不得清除登录会话、服务端历史订单、账号或默认取货信息。
- 注销必须保留两次确认、未完成订单拦截和网络错误反馈。
- 普通设置项触控高度不得小于 `88rpx`。
- 不新增后端接口或第三方依赖。
- 页面视觉必须沿用现有深蓝主题、设计令牌、卡片圆角和分割线。

---

## File Map

- Create `mini/miniprogram/store/local-usage-data.ts`: 定义搜索记录键并提供可注入、可测试的精准清理函数。
- Modify `mini/miniprogram/store/checkout.ts`: 导出待提交订单存储键，供精准清理模块复用。
- Modify `mini/miniprogram/pages/search/index.ts`: 复用统一的搜索记录键。
- Create `mini/tests/local-usage-data.spec.ts`: 验证清理范围不包含登录会话。
- Create `mini/miniprogram/pages/settings/index.ts`: 设置页状态、跳转、退出、清理和注销编排。
- Create `mini/miniprogram/pages/settings/presentation.ts`: 登录状态文案、清理确认和注销二次确认。
- Create `mini/miniprogram/pages/settings/index.wxml`: 三组设置项及错误反馈。
- Create `mini/miniprogram/pages/settings/index.wxss`: 深蓝主题分组卡片和危险操作样式。
- Create `mini/miniprogram/pages/settings/index.json`: 设置页标题和组件配置。
- Create `mini/tests/settings.spec.ts`: 设置页纯逻辑和关键页面结构测试。
- Modify `mini/miniprogram/app.json`: 注册设置页。
- Modify `mini/miniprogram/pages/profile/index.ts`: 移除退出、注销逻辑并增加设置跳转。
- Modify `mini/miniprogram/pages/profile/index.wxml`: 移除底部账号操作并增加设置入口。
- Modify `mini/miniprogram/pages/profile/index.wxss`: 删除旧账号操作样式并增加设置入口样式。
- Modify `mini/miniprogram/pages/profile/presentation.ts`: 删除已迁移的注销确认类型和函数。
- Modify `mini/tests/profile.spec.ts`: 将注销确认测试迁往设置页，并验证默认取货逻辑保持不变。
- Modify `mini/miniprogram/pages/legal/index.ts`: 将注销路径更新为“我的—设置—注销账号”。
- Modify `mini/tests/legal-content.spec.ts`: 锁定新的注销路径。
- Modify `mini/tests/navy-fresh-ui-contract.spec.ts`: 增加设置页注册、入口和触控高度契约。

---

### Task 1: 精准清理本地使用记录

**Files:**
- Create: `mini/miniprogram/store/local-usage-data.ts`
- Modify: `mini/miniprogram/store/checkout.ts`
- Modify: `mini/miniprogram/pages/search/index.ts`
- Test: `mini/tests/local-usage-data.spec.ts`

**Interfaces:**
- Consumes: `Cart.clear(): void`、微信存储的 `removeStorageSync(key: string): void`
- Produces: `RECENT_SEARCHES_STORAGE_KEY`、`clearLocalUsageData(): void`、`createLocalUsageDataCleaner(dependencies): () => void`

- [ ] **Step 1: 写入失败测试**

```ts
import { describe, expect, it, vi } from 'vitest'
import {
  createLocalUsageDataCleaner,
  RECENT_SEARCHES_STORAGE_KEY,
} from '../miniprogram/store/local-usage-data'
import { PENDING_CHECKOUT_STORAGE_KEY } from '../miniprogram/store/checkout'
import { SESSION_STORAGE_KEY } from '../miniprogram/store/session'

describe('local usage data cleanup', () => {
  it('clears cart, searches and pending checkout without clearing session', () => {
    const clearCart = vi.fn()
    const removeStorage = vi.fn()
    const clear = createLocalUsageDataCleaner({
      cart: { clear: clearCart },
      removeStorage,
    })

    clear()

    expect(clearCart).toHaveBeenCalledOnce()
    expect(removeStorage).toHaveBeenCalledWith(RECENT_SEARCHES_STORAGE_KEY)
    expect(removeStorage).toHaveBeenCalledWith(PENDING_CHECKOUT_STORAGE_KEY)
    expect(removeStorage).not.toHaveBeenCalledWith(SESSION_STORAGE_KEY)
  })
})
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `cd mini; npm test -- --run tests/local-usage-data.spec.ts`

Expected: FAIL，提示无法解析 `store/local-usage-data` 或缺少导出。

- [ ] **Step 3: 导出待提交订单存储键**

在 `mini/miniprogram/store/checkout.ts` 中将：

```ts
const PENDING_CHECKOUT_STORAGE_KEY = 'smart-store-pending-checkout-v1'
```

改为：

```ts
export const PENDING_CHECKOUT_STORAGE_KEY =
  'smart-store-pending-checkout-v1'
```

- [ ] **Step 4: 实现本地使用记录清理模块**

```ts
import type { Cart } from './cart'
import { cart } from './cart'
import { PENDING_CHECKOUT_STORAGE_KEY } from './checkout'

export const RECENT_SEARCHES_STORAGE_KEY =
  'smart-store-recent-searches-v1'

interface LocalUsageDataDependencies {
  cart: Pick<Cart, 'clear'>
  removeStorage(key: string): void
}

export const createLocalUsageDataCleaner =
  (dependencies: LocalUsageDataDependencies) => (): void => {
    dependencies.cart.clear()
    dependencies.removeStorage(RECENT_SEARCHES_STORAGE_KEY)
    dependencies.removeStorage(PENDING_CHECKOUT_STORAGE_KEY)
  }

export const clearLocalUsageData = createLocalUsageDataCleaner({
  cart,
  removeStorage: (key) => wx.removeStorageSync(key),
})
```

将 `mini/miniprogram/pages/search/index.ts` 中的私有 `recentStorageKey` 替换为导入的 `RECENT_SEARCHES_STORAGE_KEY`，所有读、写、删除均使用该常量。

- [ ] **Step 5: 运行测试并确认通过**

Run: `cd mini; npm test -- --run tests/local-usage-data.spec.ts tests/checkout.spec.ts tests/cart.spec.ts`

Expected: 3 个测试文件全部 PASS。

- [ ] **Step 6: 提交**

```powershell
git add mini/miniprogram/store/local-usage-data.ts mini/miniprogram/store/checkout.ts mini/miniprogram/pages/search/index.ts mini/tests/local-usage-data.spec.ts
git commit -m "feat: add targeted local usage cleanup"
```

---

### Task 2: 创建设置页及账号操作

**Files:**
- Create: `mini/miniprogram/pages/settings/presentation.ts`
- Create: `mini/miniprogram/pages/settings/index.ts`
- Create: `mini/miniprogram/pages/settings/index.wxml`
- Create: `mini/miniprogram/pages/settings/index.wxss`
- Create: `mini/miniprogram/pages/settings/index.json`
- Create: `mini/tests/settings.spec.ts`

**Interfaces:**
- Consumes: `sessionStore.current()`、`sessionStore.clear()`、`profileService.deleteAccount()`、`clearLocalUsageData()`、`cart.clear()`
- Produces: `buildSettingsView(loggedIn)`、`confirmLocalUsageCleanup(showConfirmation)`、`confirmAccountDeletion(showConfirmation)` 和 `/pages/settings/index`

- [ ] **Step 1: 写入设置页纯逻辑失败测试**

```ts
import { describe, expect, it, vi } from 'vitest'
import {
  buildSettingsView,
  confirmAccountDeletion,
  confirmLocalUsageCleanup,
} from '../miniprogram/pages/settings/presentation'

describe('settings presentation', () => {
  it('describes logged-in and logged-out account states', () => {
    expect(buildSettingsView(true)).toEqual({
      loggedIn: true,
      accountStatus: '微信账号 · 已登录',
    })
    expect(buildSettingsView(false)).toEqual({
      loggedIn: false,
      accountStatus: '未登录',
    })
  })

  it('explains the exact local cleanup scope', async () => {
    const confirm = vi.fn().mockResolvedValue(true)
    await expect(confirmLocalUsageCleanup(confirm)).resolves.toBe(true)
    expect(confirm.mock.calls[0][0].content).toContain('购物车')
    expect(confirm.mock.calls[0][0].content).toContain('搜索记录')
    expect(confirm.mock.calls[0][0].content).toContain('不会删除账号')
  })

  it('requires two confirmations before account deletion', async () => {
    const confirm = vi
      .fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
    await expect(confirmAccountDeletion(confirm)).resolves.toBe(true)
    expect(confirm).toHaveBeenCalledTimes(2)
  })
})
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `cd mini; npm test -- --run tests/settings.spec.ts`

Expected: FAIL，提示 `pages/settings/presentation` 不存在。

- [ ] **Step 3: 实现设置页纯逻辑**

在 `presentation.ts` 中定义：

```ts
export interface SettingsView {
  loggedIn: boolean
  accountStatus: string
}

export interface ConfirmationOptions {
  title: string
  content: string
  confirmText: string
  confirmColor?: string
}

export type ShowConfirmation = (
  options: ConfirmationOptions,
) => Promise<boolean>

export const buildSettingsView = (loggedIn: boolean): SettingsView => ({
  loggedIn,
  accountStatus: loggedIn ? '微信账号 · 已登录' : '未登录',
})
```

同时实现：

- `confirmLocalUsageCleanup()`：一次确认，说明精确清理范围和不受影响的数据；
- `confirmAccountDeletion()`：完整迁移现有两次确认文案及红色最终确认。

- [ ] **Step 4: 创建设置页结构**

`index.wxml` 必须包含三组：

```xml
<view class="settings-page">
  <view class="settings-header">设置</view>
  <view class="settings-content">
    <view class="settings-group">
      <text class="settings-group-title">账号设置</text>
      <view class="settings-row">
        <text>当前账号</text>
        <text class="settings-value">{{accountStatus}}</text>
      </view>
      <view wx:if="{{loggedIn}}" class="settings-row is-action" role="button" bindtap="onLogout">
        <text>退出登录</text>
        <image class="settings-chevron" src="/assets/icons/chevron-right.svg" mode="aspectFit" />
      </view>
    </view>

    <view class="settings-group">
      <text class="settings-group-title">隐私设置</text>
      <view class="settings-row is-action" role="button" bindtap="onTerms"><text>用户服务协议</text></view>
      <view class="settings-row is-action" role="button" bindtap="onPrivacy"><text>隐私政策</text></view>
      <view class="settings-row is-action" role="button" bindtap="onClearLocalData"><text>清除本地使用记录</text></view>
    </view>

    <view wx:if="{{loggedIn}}" class="settings-group danger-group">
      <text class="settings-group-title">账号管理</text>
      <button class="delete-account-button" loading="{{deleting}}" disabled="{{deleting}}" bindtap="onDeleteAccount">
        {{deleting ? '注销中…' : '注销账号'}}
      </button>
    </view>

    <view wx:if="{{error}}" class="settings-error" role="alert">{{error}}</view>
  </view>
</view>
```

每个 `.settings-row` 设置 `min-height: 96rpx`；卡片、颜色、边框、字体和间距全部使用现有 CSS 变量。

- [ ] **Step 5: 实现设置页行为**

`index.ts`：

- `onShow()` 使用 `buildSettingsView(Boolean(sessionStore.current()))` 刷新登录状态；
- `onTerms()` 和 `onPrivacy()` 分别跳转 `/pages/legal/index?type=terms` 与 `?type=privacy`，并在 `navigateTo.fail` 中提示“页面暂时无法打开”；
- `onClearLocalData()` 确认后在 `try/catch` 中调用 `clearLocalUsageData()`，仅成功时提示“本地使用记录已清除”，失败时写入“本地记录清除失败，请稍后重试”；
- `onLogout()` 确认后调用 `sessionStore.clear()` 并 `wx.navigateBack()`；
- `onDeleteAccount()` 复用两次确认，成功后调用 `clearLocalUsageData()`、`sessionStore.clear()`、`wx.clearStorageSync()`，再返回“我的”页；
- 所有异步操作用 `clearing`、`deleting` 防止重复点击，错误写入 `error`。

- [ ] **Step 6: 增加页面结构契约并运行测试**

在 `settings.spec.ts` 读取 WXML/WXSS，断言：

```ts
expect(markup).toContain('账号设置')
expect(markup).toContain('隐私设置')
expect(markup).toContain('账号管理')
expect(markup).not.toContain('默认取货信息')
expect(styles).toMatch(/\.settings-row\s*\{[\s\S]*?min-height:\s*96rpx;/)
```

Run: `cd mini; npm test -- --run tests/settings.spec.ts tests/profile.spec.ts`

Expected: 两个测试文件全部 PASS。

- [ ] **Step 7: 提交**

```powershell
git add mini/miniprogram/pages/settings mini/tests/settings.spec.ts
git commit -m "feat: add mini program settings page"
```

---

### Task 3: 从“我的”页迁移入口并同步法律文本

**Files:**
- Modify: `mini/miniprogram/app.json`
- Modify: `mini/miniprogram/pages/profile/index.ts`
- Modify: `mini/miniprogram/pages/profile/index.wxml`
- Modify: `mini/miniprogram/pages/profile/index.wxss`
- Modify: `mini/miniprogram/pages/profile/presentation.ts`
- Modify: `mini/tests/profile.spec.ts`
- Modify: `mini/miniprogram/pages/legal/index.ts`
- Modify: `mini/tests/legal-content.spec.ts`
- Modify: `mini/tests/navy-fresh-ui-contract.spec.ts`

**Interfaces:**
- Consumes: `/pages/settings/index`
- Produces: “我的 → 设置 → 注销账号”的唯一注销路径

- [ ] **Step 1: 写入失败的导航与法律契约**

在 `navy-fresh-ui-contract.spec.ts` 增加：

```ts
it('moves account operations into the registered settings page', () => {
  const appConfig = JSON.parse(read('app.json')) as { pages: string[] }
  const profile = read('pages/profile/index.wxml')
  const settings = read('pages/settings/index.wxml')

  expect(appConfig.pages).toContain('pages/settings/index')
  expect(profile).toContain('bindtap="onSettings"')
  expect(profile).not.toContain('bindtap="onDeleteAccount"')
  expect(profile).not.toContain('bindtap="onLogout"')
  expect(profile).toContain('默认取货信息')
  expect(settings).not.toContain('默认取货信息')
})
```

将 `legal-content.spec.ts` 的旧路径断言替换为：

```ts
expect(content).toContain('“我的”—“设置”—“注销账号”')
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `cd mini; npm test -- --run tests/navy-fresh-ui-contract.spec.ts tests/legal-content.spec.ts`

Expected: FAIL，指出设置页未注册、旧操作仍在“我的”页、法律路径仍为旧文案。

- [ ] **Step 3: 注册设置页并迁移“我的”页操作**

在 `app.json` 的 `pages/profile/index` 前注册：

```json
"pages/settings/index",
```

在 `profile/index.ts`：

- 删除 `cart`、`confirmAccountDeletion`、`ConfirmationOptions` 导入；
- 删除 `deleting` 数据字段；
- 删除 `onLogout()` 和 `onDeleteAccount()`；
- 新增：

```ts
onSettings() {
  wx.navigateTo({ url: '/pages/settings/index' })
},
```

在 `profile/index.wxml`：

- 删除 `.account-actions` 整段；
- 在默认取货卡片之后增加独立设置入口；
- 保证默认取货信息卡片和保存按钮保持原位。

在 `profile/index.wxss`：

- 删除 `.account-actions`、`.logout-button`、`.delete-account-button`；
- 新增触控高度不少于 `96rpx` 的 `.settings-entry`。

从 `profile/presentation.ts` 删除已经迁移到设置页的确认类型和函数，并从 `profile.spec.ts` 删除对应测试；保留默认取货展示和校验测试。

- [ ] **Step 4: 更新法律文本路径**

将隐私政策中的：

```text
“我的”—“注销账号”
```

更新为：

```text
“我的”—“设置”—“注销账号”
```

不改动注销条件、数据删除范围和法定留存说明。

- [ ] **Step 5: 运行相关测试并确认通过**

Run: `cd mini; npm test -- --run tests/profile.spec.ts tests/settings.spec.ts tests/legal-content.spec.ts tests/navy-fresh-ui-contract.spec.ts`

Expected: 4 个测试文件全部 PASS。

- [ ] **Step 6: 提交**

```powershell
git add mini/miniprogram/app.json mini/miniprogram/pages/profile mini/miniprogram/pages/legal/index.ts mini/tests/profile.spec.ts mini/tests/legal-content.spec.ts mini/tests/navy-fresh-ui-contract.spec.ts
git commit -m "feat: move account management into settings"
```

---

### Task 4: 完整验证与微信开发者工具验收

**Files:**
- Verify: `mini/miniprogram/**`
- Verify: `mini/tests/**`

**Interfaces:**
- Consumes: Tasks 1–3 的全部交付物
- Produces: 可在微信开发者工具中验收的设置页

- [ ] **Step 1: 运行完整自动化测试**

Run: `cd mini; npm test -- --run`

Expected: 所有测试文件和测试用例 PASS，0 failures。

- [ ] **Step 2: 运行 TypeScript 类型检查**

Run: `cd mini; npm run typecheck`

Expected: 退出码 0，无类型错误。

- [ ] **Step 3: 检查补丁格式**

Run: `git diff --check`

Expected: 退出码 0，无空白错误。

- [ ] **Step 4: 在微信开发者工具中验收**

按以下顺序检查：

1. 未登录进入“我的”，可以看到“设置”，看不到页面底部的退出和注销；
2. 未登录进入设置，可以查看协议、隐私政策和清除本地使用记录；
3. 登录后默认取货信息仍在“我的”页正常保存；
4. 设置页显示“微信账号 · 已登录”、退出登录和注销账号；
5. 清除本地使用记录后登录状态和默认取货信息仍保留；
6. 退出登录后返回“我的”并显示未登录状态；
7. 再次登录后测试注销两次确认、未完成订单拦截和成功注销；
8. 设置页、弹窗和底部安全区域在模拟器中无覆盖、无截断。

- [ ] **Step 5: 提交验证期间产生的必要修正**

仅当验收发现并修正问题时执行：

```powershell
git add mini/miniprogram mini/tests
git commit -m "fix: finalize mini program settings flow"
```
