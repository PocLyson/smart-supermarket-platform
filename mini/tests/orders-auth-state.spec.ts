import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const miniRoot = resolve(__dirname, '..', 'miniprogram')
const read = (relativePath: string) =>
  readFileSync(resolve(miniRoot, relativePath), 'utf8')

describe('orders logged-out state', () => {
  it('renders a login prompt instead of a load failure', () => {
    const markup = read('pages/orders/index.wxml')

    expect(markup).toContain('wx:if="{{authRequired}}"')
    expect(markup).toContain('登录后查看订单')
    expect(markup).toContain('登录后可查看订单状态和历史记录')
    expect(markup).toContain('bindtap="onLogin"')
    expect(markup).toContain('微信登录')
    expect(markup).toContain('bindtap="onBackToProfile"')
    expect(markup).toContain('返回我的')
  })

  it('uses vertically centered custom state actions', () => {
    const markup = read('pages/orders/index.wxml')
    const styles = read('pages/orders/index.wxss')

    expect(markup).not.toContain('<button class="button-secondary orders-state-action"')
    expect(styles).toMatch(
      /\.orders-state-action\s*\{[\s\S]*?min-height:\s*72rpx;[\s\S]*?padding:\s*0 var\(--space-5\);[\s\S]*?align-items:\s*center;[\s\S]*?justify-content:\s*center;/,
    )
  })

  it('keeps profile in the navigation stack for a normal back arrow', () => {
    const profileSource = read('pages/profile/index.ts')

    expect(profileSource).toContain(
      "wx.navigateTo({ url: '/pages/orders/index' })",
    )
    expect(profileSource).not.toContain(
      "wx.redirectTo({ url: '/pages/orders/index' })",
    )
  })

  it('does not request orders while logged out', () => {
    const ordersSource = read('pages/orders/index.ts')

    expect(ordersSource).toContain(
      'const loggedIn = Boolean(sessionStore.current())',
    )
    expect(ordersSource).toContain(
      'if (!loggedIn)',
    )
    expect(ordersSource).toContain(
      'authRequired: true',
    )
  })
})
