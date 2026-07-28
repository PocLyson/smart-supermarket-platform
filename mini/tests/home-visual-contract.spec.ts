import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const miniRoot = resolve(__dirname, '..', 'miniprogram')

function read(relativePath: string) {
  return readFileSync(resolve(miniRoot, relativePath), 'utf8')
}

describe('navy fresh retail visual contract', () => {
  it('publishes the approved navy fresh retail palette', () => {
    const theme = read('styles/theme.wxss')
    const appConfig = JSON.parse(read('app.json')) as {
      window?: { navigationBarTitleText?: string }
    }

    expect(theme).toContain('--primary-600: #082F6B;')
    expect(theme).toContain('--primary-700: #082F6B;')
    expect(theme).toContain('--primary-100: #EAF2FF;')
    expect(theme).toContain('--color-bg-page: #F7F9FC;')
    expect(theme).toContain('--color-text-primary: #0D1B36;')
    expect(theme).toContain('--color-success: #2E9B62;')
    expect(theme).toContain('--color-price: #E5484D;')
    expect(theme).not.toContain('#8E2F3F')
    expect(appConfig.window?.navigationBarTitleText).toBe(
      '鲁能超市李老家分店',
    )
  })

  it('keeps every required home region and excludes the AI assistant', () => {
    const home = read('pages/home/index.wxml')
    const navigation = read('components/app-tab-bar/index.wxml')

    expect(home).toContain('鲁能超市李老家分店')
    expect(home).toContain('home-hero')
    expect(home).toContain('category-grid')
    expect(home).toContain('product-grid')
    expect(home).toContain('精选商品')
    expect(navigation).toContain('首页')
    expect(navigation).toContain('分类')
    expect(navigation).toContain('购物车')
    expect(navigation).toContain('我的')
    expect(navigation).not.toContain('value="orders"')
    expect(home).not.toContain('AI 助手')
  })

  it('distributes the four preview navigation items evenly', () => {
    const preview = readFileSync(
      resolve(miniRoot, '..', '..', 'docs', 'ui', 'mini-program-preview.html'),
      'utf8',
    )
    const navButtons = preview.match(/<button[^>]+data-view=/g) ?? []

    expect(navButtons).toHaveLength(4)
    expect(preview).toMatch(
      /nav\s*\{[^}]*display:\s*flex;[^}]*\}/,
    )
    expect(preview).toMatch(
      /nav button\s*\{[^}]*flex:\s*1;/,
    )
    expect(preview).not.toMatch(
      /nav\s*\{[^}]*grid-template-columns:\s*repeat\(5,\s*1fr\);/,
    )
  })

  it('gives every commerce page a clear retail hierarchy', () => {
    expect(read('pages/product/index.wxml')).toContain('product-purchase-bar')
    expect(read('pages/cart/index.wxml')).toContain('cart-summary-bar')
    expect(read('pages/checkout/index.wxml')).toContain('checkout-section')
    expect(read('pages/orders/index.wxml')).toContain('orders-header')
    expect(read('pages/order-detail/index.wxml')).toContain('status-timeline')
  })

  it('uses TDesign for shared search, button, icon and tab bar controls', () => {
    const home = read('pages/home/index.wxml')
    const pageConfig = JSON.parse(read('pages/home/index.json')) as {
      usingComponents?: Record<string, string>
    }

    expect(home).toContain('<t-search')
    expect(home).toContain('<t-button')
    expect(home).toContain('<app-tab-bar')
    expect(home).toContain('<t-icon')
    expect(pageConfig.usingComponents).toMatchObject({
      't-button': 'tdesign-miniprogram/button/button',
      't-icon': 'tdesign-miniprogram/icon/icon',
      't-search': 'tdesign-miniprogram/search/search',
      'app-tab-bar': '../../components/app-tab-bar/index',
    })
  })

  it('keeps the home search compact with a restrained action ratio', () => {
    const styles = read('pages/home/index.wxss')

    expect(styles).toMatch(
      /\.search-card\s*\{[\s\S]*?height:\s*96rpx;[\s\S]*?padding:\s*4rpx;[\s\S]*?gap:\s*8rpx;/,
    )
    expect(styles).toMatch(
      /\.search-card\s*\{[\s\S]*?--td-search-height:\s*88rpx;/,
    )
    expect(styles).toMatch(
      /\.search-button\s*\{[\s\S]*?width:\s*164rpx;[\s\S]*?min-width:\s*164rpx;[\s\S]*?min-height:\s*88rpx;/,
    )
    expect(styles).toMatch(
      /\.search-button\s*\{[\s\S]*?flex:\s*0 0 164rpx;/,
    )
  })

  it('keeps the hero badge concise and inside the copy column', () => {
    const home = read('pages/home/index.wxml')
    const styles = read('pages/home/index.wxss')

    expect(home).toContain('<text class="hero-kicker">今日精选</text>')
    expect(home).not.toContain('鲁能超市李老家分店 · 今日精选')
    expect(styles).toMatch(
      /\.hero-kicker\s*\{[\s\S]*?box-sizing:\s*border-box;[\s\S]*?max-width:\s*100%;[\s\S]*?padding:\s*8rpx 20rpx;[\s\S]*?white-space:\s*nowrap;/,
    )
    expect(styles).toMatch(
      /\.hero-kicker\s*\{[\s\S]*?margin-bottom:\s*24rpx;/,
    )
  })

  it('registers a real profile page', () => {
    const appConfig = JSON.parse(read('app.json')) as { pages: string[] }
    const profile = read('pages/profile/index.wxml')

    expect(appConfig.pages).toContain('pages/profile/index')
    expect(profile).toContain('默认取货信息')
    expect(profile).toContain('我的订单')
    expect(profile).toContain('<app-tab-bar value="profile"')
    expect(read('pages/orders/index.wxml')).not.toContain('<app-tab-bar')
  })

  it('registers dedicated category, search, and submit result pages', () => {
    const appConfig = JSON.parse(read('app.json')) as { pages: string[] }

    expect(appConfig.pages).toContain('pages/category/index')
    expect(appConfig.pages).toContain('pages/search/index')
    expect(appConfig.pages).toContain('pages/submit-result/index')
    expect(appConfig.pages).toContain('pages/auth/index')
  })

  it('lays out the six backend categories as a balanced two-row grid', () => {
    const home = read('pages/home/index.wxml')
    const homeStyles = read('pages/home/index.wxss')

    expect(home).toContain('wx:for="{{categoryPresentation}}"')
    expect(home).toContain('class="category-slot"')
    expect(home).toContain('role="button"')
    expect(home).not.toContain('<button class="category-item')
    expect(home).not.toContain('index < 9')
    expect(home).not.toContain('全部分类')
    expect(homeStyles).toMatch(
      /\.category-grid\s*\{[\s\S]*?display:\s*grid;[\s\S]*?grid-template-columns:\s*repeat\(3,\s*1fr\);/,
    )
    expect(homeStyles).toMatch(
      /\.category-item\s*\{[\s\S]*?box-sizing:\s*border-box;[\s\S]*?width:\s*100%;/,
    )
  })

  it('pins the confirmed TDesign version', () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(miniRoot, '..', 'package.json'), 'utf8'),
    ) as { dependencies?: Record<string, string> }

    expect(packageJson.dependencies?.['tdesign-miniprogram']).toBe('1.15.3')
  })
})
