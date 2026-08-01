import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const miniRoot = resolve(__dirname, '..', 'miniprogram')
const read = (relativePath: string) =>
  readFileSync(resolve(miniRoot, relativePath), 'utf8')

const braceBalance = (source: string) =>
  [...source].reduce(
    (balance, character) =>
      character === '{' ? balance + 1 : character === '}' ? balance - 1 : balance,
    0,
  )

describe('approved navy fresh UI structure', () => {
  it('uses a floating four-item capsule with a safe-area offset', () => {
    const markup = read('components/app-tab-bar/index.wxml')
    const styles = read('components/app-tab-bar/index.wxss')

    expect(braceBalance(styles)).toBe(0)
    expect(markup.match(/class="tab-item/g)).toHaveLength(4)
    expect(styles).toMatch(/\.app-tab-bar\s*\{[\s\S]*?left:\s*36rpx;/)
    expect(styles).toMatch(
      /\.app-tab-bar\s*\{[\s\S]*?right:\s*36rpx;[\s\S]*?border-radius:\s*var\(--radius-round\);/,
    )
    expect(styles).toContain('env(safe-area-inset-bottom)')
    expect(styles).toMatch(/\.tab-item\s*\{[\s\S]*?min-height:\s*88rpx;/)
    expect(styles).toMatch(
      /\.tab-item\.is-active\s*\{[\s\S]*?background:\s*var\(--primary-100\);/,
    )
  })

  it('implements the approved compact category strip and order filters', () => {
    const category = read('pages/category/index.wxml')
    const categoryStyles = read('pages/category/index.wxss')
    const orders = read('pages/orders/index.wxml')

    expect(category).toContain('category-strip')
    expect(category).not.toContain('category-rail')
    expect(category).toContain('wx:for="{{categoryPresentation}}"')
    expect(category).toContain('{{item.name}}')
    expect(category).toContain('已展示 {{products.length}} 件')
    expect(category).toContain('aria-label="查看分类 {{item.name}}"')
    expect(category).toContain('hover-class="category-chip-hover"')
    expect(categoryStyles).toMatch(
      /\.category-chip\s*\{[\s\S]*?width:\s*120rpx;[\s\S]*?min-height:\s*152rpx;/,
    )
    expect(categoryStyles).toMatch(
      /\.category-chip-label\s*\{[\s\S]*?font-size:\s*24rpx;/,
    )
    expect(categoryStyles).toMatch(
      /\.category-chip\.is-selected\s*\{[\s\S]*?border-color:\s*var\(--primary-600\);/,
    )
    expect(categoryStyles).toMatch(
      /\.category-chip-hover\s*\{[\s\S]*?background:\s*var\(--primary-50\);/,
    )
    expect(orders).toContain('order-filters')
    expect(orders).toContain('全部')
    expect(orders).toContain('待确认')
    expect(orders).toContain('备货中')
    expect(orders).toContain('待取货')
  })

  it('places logged-out WeChat login in the profile header only', () => {
    const profile = read('pages/profile/index.wxml')
    const profileStyles = read('pages/profile/index.wxss')
    const presentation = read('pages/profile/presentation.ts')

    expect(presentation).toContain("displayName: '登录 / 注册'")
    expect(presentation).toContain("pickupSummary: '同步订单与购物车'")
    expect(profile).toContain('profile-login-button')
    expect(profile).not.toContain('login-guide')
    expect(profile).not.toContain('微信用户')
    expect(profile).toContain('order-status-grid')
    expect(profileStyles).toMatch(
      /\.profile-login-button\s*\{[\s\S]*?display:\s*flex;[\s\S]*?height:\s*88rpx;[\s\S]*?line-height:\s*1;[\s\S]*?align-items:\s*center;[\s\S]*?justify-content:\s*center;/,
    )
  })

  it('uses the profile custom header without the redundant native home control', () => {
    const profileConfig = JSON.parse(read('pages/profile/index.json')) as {
      navigationStyle?: string
    }
    const profile = read('pages/profile/index.wxml')
    const profileStyles = read('pages/profile/index.wxss')

    expect(profileConfig.navigationStyle).toBe('custom')
    expect(profile).toContain('class="profile-title">我的</view>')
    expect(profile).toContain('<app-tab-bar value="profile" />')
    expect(profileStyles).toMatch(
      /\.profile-hero\s*\{[\s\S]*?padding:\s*calc\(env\(safe-area-inset-top\) \+ 112rpx\)/,
    )
  })

  it('uses custom primary-tab headers and one consistent category icon', () => {
    const categoryConfig = JSON.parse(read('pages/category/index.json')) as {
      navigationStyle?: string
    }
    const cartConfig = JSON.parse(read('pages/cart/index.json')) as {
      navigationStyle?: string
    }
    const category = read('pages/category/index.wxml')
    const categoryStyles = read('pages/category/index.wxss')
    const cart = read('pages/cart/index.wxml')
    const cartStyles = read('pages/cart/index.wxss')
    const tabBar = read('components/app-tab-bar/index.wxml')
    const inactiveCategoryIcon = read('assets/icons/view-module.svg')

    expect(categoryConfig.navigationStyle).toBe('custom')
    expect(cartConfig.navigationStyle).toBe('custom')
    expect(category).toContain('class="category-nav-title">商品分类</text>')
    expect(categoryStyles).toContain(
      'padding: calc(env(safe-area-inset-top) + 112rpx)',
    )
    expect(cart).toContain('class="cart-topbar-title">购物车</text>')
    expect(cartStyles).toContain(
      'padding: calc(env(safe-area-inset-top) + 112rpx)',
    )
    expect(tabBar).toContain(
      "value === 'category' ? '/assets/icons/view-module-active.svg' : '/assets/icons/view-module.svg'",
    )
    expect(inactiveCategoryIcon.match(/<rect /g)).toHaveLength(4)
    expect(inactiveCategoryIcon).toContain('fill="none"')
    expect(inactiveCategoryIcon).toContain('stroke="#6F666A"')
  })

  it('keeps product purchase information readable above the fixed action bar', () => {
    const product = read('pages/product/index.wxml')
    const productStyles = read('pages/product/index.wxss')

    expect(product).toContain('aria-label="{{product.name}} 商品图片"')
    expect(product).toContain('aria-label="减少购买数量"')
    expect(product).toContain('aria-label="增加购买数量"')
    expect(product).toContain('class="product-store-copy"')
    expect(product).toContain('class="product-description-copy"')
    expect(product).toContain('hover-class="button-hover"')
    expect(productStyles).toMatch(
      /\.product-page\s*\{[\s\S]*?padding-bottom:\s*calc\(208rpx \+ env\(safe-area-inset-bottom\)\);/,
    )
    expect(productStyles).toMatch(
      /\.product-stock-row\s*\{[\s\S]*?flex-wrap:\s*wrap;/,
    )
    expect(productStyles).toMatch(
      /\.product-stock-row\s*\{[\s\S]*?min-height:\s*96rpx;[\s\S]*?border-bottom:\s*var\(--border-width-default\) solid var\(--color-divider\);/,
    )
    expect(productStyles).toMatch(
      /\.product-store-copy\s*\{[\s\S]*?font-size:\s*24rpx;/,
    )
    expect(product).toContain(
      '<text class="quantity-value">{{quantity}}</text>',
    )
    expect(product).toContain(
      "quantity-button {{quantity === 1 ? 'is-disabled' : ''}}",
    )
    expect(productStyles).toMatch(
      /\.quantity-stepper\s*\{[\s\S]*?display:\s*flex;[\s\S]*?width:\s*240rpx;/,
    )
    expect(productStyles).toContain('.quantity-button.is-disabled')
    expect(productStyles).not.toContain('.quantity-button[disabled]')
    expect(productStyles).toMatch(
      /\.quantity-row\s*\{[\s\S]*?min-height:\s*112rpx;/,
    )
    expect(productStyles).not.toMatch(
      /\.quantity-row\s*\{[^}]*border-bottom:/,
    )
    expect(productStyles).toMatch(
      /\.product-info\s*\{[\s\S]*?padding:\s*var\(--space-5\) var\(--space-5\) 0;/,
    )
  })

  it('provides local image error recovery on every product-heavy page', () => {
    for (const page of ['home', 'category', 'search', 'product', 'cart', 'checkout']) {
      const markup = read(`pages/${page}/index.wxml`)
      expect(markup, page).toContain('binderror="onImageError"')
      expect(markup, page).toContain('image-placeholder.svg')
    }
  })

  it('uses the official store name wherever a specific store is shown', () => {
    const files = [
      'pages/home/index.wxml',
      'pages/product/index.wxml',
      'pages/checkout/index.wxml',
      'pages/submit-result/index.wxml',
      'pages/orders/index.wxml',
      'pages/order-detail/index.wxml',
      'pages/profile/index.wxml',
    ]
    const customerCopy = files.map(read).join('\n')

    expect(customerCopy).toContain('鲁能超市李老家分店')
    expect(customerCopy).not.toMatch(/(?<!鲁能超市)李老家分店/)
  })

  it('registers explicit auth and all approved secondary states', () => {
    const appConfig = JSON.parse(read('app.json')) as { pages: string[] }
    const auth = read('pages/auth/index.wxml')
    const submitResult = read('pages/submit-result/index.wxml')

    expect(appConfig.pages).toContain('pages/auth/index')
    expect(auth).toContain('微信登录')
    expect(auth).toContain('同步订单与购物车')
    expect(submitResult).toContain('订单提交成功')
    expect(submitResult).toContain('订单结果确认中')
  })

  it('moves account operations into the registered settings page', () => {
    const appConfig = JSON.parse(read('app.json')) as { pages: string[] }
    const profile = read('pages/profile/index.wxml')
    const settings = read('pages/settings/index.wxml')

    expect(appConfig.pages).toContain('pages/settings/index')
    expect(profile).toContain('bindtap="onSettings"')
    expect(profile).not.toContain('bindtap="onDeleteAccount"')
    expect(profile).not.toContain('bindtap="onLogout"')
    expect(profile).not.toContain('保存取货信息')
    expect(settings).toContain('取货信息')
  })

  it('uses class selectors that the WeChat component compiler accepts', () => {
    const styleFiles = [
      'pages/home/index.wxss',
      'pages/category/index.wxss',
      'pages/search/index.wxss',
      'pages/product/index.wxss',
      'pages/auth/index.wxss',
      'pages/profile/index.wxss',
      'pages/order-detail/index.wxss',
    ]

    for (const file of styleFiles) {
      expect(read(file), file).not.toMatch(
        /\.[A-Za-z0-9_-]+\s+(?:image|text|view|button)(?::[A-Za-z-]+)?\s*\{/,
      )
    }
  })
})
