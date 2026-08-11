import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'

const pageSource = (page: string, extension: 'wxml' | 'wxss' | 'json') =>
  readFileSync(resolve(`miniprogram/pages/${page}/index.${extension}`), 'utf8')

describe('merchant top-level page presentation', () => {
  test.each([
    ['orders', '订单管理'],
    ['verify-pickup', '取货核销'],
    ['messages-unavailable', '消息中心'],
    ['profile', '我的'],
  ])('%s uses the approved custom navy header', (page, title) => {
    const markup = pageSource(page, 'wxml')
    const styles = pageSource(page, 'wxss')
    const config = JSON.parse(pageSource(page, 'json')) as { navigationStyle?: string }

    expect(config.navigationStyle).toBe('custom')
    expect(markup).toMatch(/class="[^"]*\bmerchant-page-header\b[^"]*"/)
    expect(markup).toContain(title)
    expect(styles).toMatch(/\.merchant-page-header\s*\{[^}]*safe-area-inset-top/s)
    expect(styles).toMatch(/\.merchant-page-header\s*\{[^}]*var\(--primary-600\)/s)
  })

  test('orders uses the selected status-board hierarchy', () => {
    const markup = pageSource('orders', 'wxml')
    const styles = pageSource('orders', 'wxss')

    expect(markup).not.toContain('门店订单')
    expect(markup).toContain('class="order-summary-strip"')
    expect(markup).toContain('class="summary-metric')
    expect(markup).toContain('class="filter-trigger')
    expect(markup).toContain('class="order-timeline"')
    for (const icon of ['refresh-cw', 'search', 'list-filter', 'chevron-right', 'circle']) {
      const iconPath = resolve(`miniprogram/assets/icons/${icon}.svg`)
      expect(markup).toContain(`/assets/icons/${icon}.svg`)
      expect(readFileSync(iconPath, 'utf8')).toContain('@license lucide-static')
    }
    expect(markup).not.toContain('<t-icon')
    expect(styles).toMatch(/\.order-summary-strip\s*\{[^}]*grid-template-columns:\s*repeat\(3,/s)
    expect(styles).toMatch(/\.order-summary-strip\s*\{[^}]*margin:\s*-24rpx\s+16rpx\s+0/s)
    expect(styles).toMatch(/\.order-summary-strip\s*\{[^}]*border-radius:\s*32rpx/s)
    expect(styles).toMatch(/\.merchant-page-header\s*\{[^}]*min-height:\s*220rpx/s)
  })

  test('pickup page presents a clear three-step verification cue', () => {
    const markup = pageSource('verify-pickup', 'wxml')

    expect(markup).toContain('class="verification-steps"')
    expect(markup).toContain('录入信息')
    expect(markup).toContain('核对订单')
    expect(markup).toContain('完成核销')
  })

  test('messages page uses a bundled icon instead of CSS-drawn artwork', () => {
    const markup = pageSource('messages-unavailable', 'wxml')

    expect(markup).toContain('/assets/icons/messages.svg')
    expect(markup).not.toContain('state-icon__line')
    expect(markup).not.toContain('state-icon__dot')
  })

  test('profile matches the selected layered security layout', () => {
    const markup = pageSource('profile', 'wxml')
    const styles = pageSource('profile', 'wxss')

    expect(markup).toMatch(/class="[^"]*\bprofile-security-header\b[^"]*"/)
    expect(markup).toContain('class="profile-identity-card"')
    expect(markup).toContain('微信已绑定')
    expect(markup).toContain('class="profile-account-card"')
    expect(markup).toContain('class="security-notice"')
    expect(markup).toContain('管理微信绑定')
    expect(markup).toContain('bindtap="confirmUnbind"')
    expect(markup).toContain('bindtap="logout"')
    expect(markup).toContain('/assets/icons/shield-check.svg')
    expect(markup).toContain('/assets/icons/info.svg')
    expect(markup).not.toContain('<employee-header')
    expect(markup).not.toContain('shortcut-chevron')
    expect(styles).toMatch(/\.profile-identity-card\s*\{[^}]*margin:\s*-96rpx/s)
    expect(styles).toMatch(/\.security-notice\s*\{[^}]*var\(--primary-100\)/s)
  })

  test('order detail uses a custom back header and operational summary', () => {
    const markup = pageSource('order-detail', 'wxml')
    const styles = pageSource('order-detail', 'wxss')
    const config = JSON.parse(pageSource('order-detail', 'json')) as { navigationStyle?: string }

    expect(config.navigationStyle).toBe('custom')
    expect(markup).toContain('class="detail-header"')
    expect(markup).toContain('bindtap="goBack"')
    expect(markup).toContain('class="summary-status-block"')
    expect(markup).toContain('订单详情')
    expect(styles).toMatch(/\.detail-header\s*\{[^}]*safe-area-inset-top/s)
    expect(styles).toMatch(/\.detail-header\s*\{[^}]*var\(--primary-600\)/s)
  })
})
