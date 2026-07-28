import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const miniRoot = resolve(__dirname, '..', 'miniprogram')

function read(relativePath: string) {
  return readFileSync(resolve(miniRoot, relativePath), 'utf8')
}

describe('burgundy retail visual contract', () => {
  it('publishes one unified burgundy retail palette', () => {
    const theme = read('styles/theme.wxss')
    const appConfig = JSON.parse(read('app.json')) as {
      window?: { navigationBarTitleText?: string }
    }

    expect(theme).toContain('--primary-600: #8E2F3F;')
    expect(theme).toContain('--primary-700: #762536;')
    expect(theme).toContain('--primary-800: #5E1D2B;')
    expect(theme).toContain('--primary-100: #F5E7EA;')
    expect(theme).toContain('--color-bg-page: #F8F5F1;')
    expect(theme).toContain('--color-text-primary: #292326;')
    expect(theme).toContain('--color-accent-gold: #A16207;')
    expect(theme).not.toContain('#DC2626')
    expect(theme).not.toContain('#2F7046')
    expect(appConfig.window?.navigationBarTitleText).toBe('智慧超市')
  })

  it('keeps every required home region and excludes the AI assistant', () => {
    const home = read('pages/home/index.wxml')
    const navigation = read('components/app-tab-bar/index.wxml')

    expect(home).toContain('鲁能超市李老家分店')
    expect(home).toContain('home-hero')
    expect(home).toContain('service-strip')
    expect(home).toContain('category-grid')
    expect(home).toContain('product-grid')
    expect(home).toContain('今日好价')
    expect(navigation).toContain('首页')
    expect(navigation).toContain('分类')
    expect(navigation).toContain('购物车')
    expect(navigation).toContain('我的')
    expect(navigation).not.toContain('value="orders"')
    expect(home).not.toContain('AI 助手')
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

  it('registers a real profile page', () => {
    const appConfig = JSON.parse(read('app.json')) as { pages: string[] }
    const profile = read('pages/profile/index.wxml')

    expect(appConfig.pages).toContain('pages/profile/index')
    expect(profile).toContain('默认取货信息')
    expect(profile).toContain('我的订单')
    expect(profile).toContain('<app-tab-bar value="profile"')
    expect(read('pages/orders/index.wxml')).not.toContain('<app-tab-bar')
  })

  it('constrains native category buttons to the five-column grid', () => {
    const home = read('pages/home/index.wxml')
    const homeStyles = read('pages/home/index.wxss')

    expect(home).toContain('class="category-slot"')
    expect(home).toContain('role="button"')
    expect(home).not.toContain('<button class="category-item')
    expect(home).not.toContain('index < 9')
    expect(home).toContain('categoryImages[index % categoryImages.length]')
    expect(homeStyles).toMatch(
      /\.category-grid\s*\{[\s\S]*?display:\s*flex;[\s\S]*?flex-wrap:\s*wrap;/,
    )
    expect(homeStyles).toMatch(
      /\.category-slot\s*\{[\s\S]*?box-sizing:\s*border-box;[\s\S]*?width:\s*20%;/,
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
