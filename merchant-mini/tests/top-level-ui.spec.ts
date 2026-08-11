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
    expect(markup).toContain('class="merchant-page-header"')
    expect(markup).toContain(title)
    expect(styles).toMatch(/\.merchant-page-header\s*\{[^}]*safe-area-inset-top/s)
    expect(styles).toMatch(/\.merchant-page-header\s*\{[^}]*var\(--primary-600\)/s)
  })

  test('orders keeps filters inside one elevated control surface', () => {
    const markup = pageSource('orders', 'wxml')
    const styles = pageSource('orders', 'wxss')

    expect(markup).toContain('class="order-filter-panel"')
    expect(markup).toContain('class="filter-section-label"')
    expect(styles).toMatch(/\.order-filter-panel\s*\{[^}]*box-shadow:\s*var\(--shadow-card\)/s)
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

  test('profile starts with a distinct employee identity panel', () => {
    const markup = pageSource('profile', 'wxml')
    const styles = pageSource('profile', 'wxss')

    expect(markup).toContain('class="profile-identity-card"')
    expect(markup).toContain('员工账号')
    expect(styles).toMatch(/\.profile-identity-card\s*\{[^}]*border-radius:/s)
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
