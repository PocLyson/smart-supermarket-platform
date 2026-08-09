import { describe, expect, test } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  NAV_ITEMS,
  shortcutsForRole,
} from '../miniprogram/components/app-tab-bar/navigation'

describe('merchant primary navigation', () => {
  test('keeps exactly the five approved top-level destinations in order', () => {
    expect(NAV_ITEMS.map((item) => item.label)).toEqual([
      '工作台',
      '订单',
      '核销',
      '消息',
      '我的',
    ])
    expect(NAV_ITEMS).toHaveLength(5)
  })

  test('routes unavailable phase-one destinations to an explanatory page', () => {
    expect(NAV_ITEMS.map((item) => item.url)).toEqual([
      '/pages/messages-unavailable/index?feature=workbench',
      '/pages/messages-unavailable/index?feature=orders',
      '/pages/messages-unavailable/index?feature=verification',
      '/pages/messages-unavailable/index?feature=messages',
      '/pages/profile/index',
    ])
  })

  test('never exposes owner-only shortcuts to a cashier', () => {
    expect(shortcutsForRole('CASHIER').some((item) => item.ownerOnly)).toBe(false)
    expect(shortcutsForRole('OWNER').some((item) => item.ownerOnly)).toBe(true)
  })

  test('registers complete native page artifacts for every navigation target', () => {
    const app = JSON.parse(readFileSync(resolve('miniprogram/app.json'), 'utf8')) as {
      pages: string[]
    }
    const pagePaths = new Set(
      NAV_ITEMS.map((item) => item.url.split('?')[0].replace(/^\//, '').replace(/\/index$/, '')),
    )

    for (const pagePath of pagePaths) {
      expect(app.pages, `${pagePath} must be registered`).toContain(`${pagePath}/index`)
      for (const extension of ['json', 'ts', 'wxml', 'wxss']) {
        expect(
          existsSync(resolve('miniprogram', `${pagePath}/index.${extension}`)),
          `${pagePath}/index.${extension} must exist`,
        ).toBe(true)
      }
    }
  })

  test('uses local linear SVG icons and no emoji in primary navigation', () => {
    const emoji = /\p{Extended_Pictographic}/u

    for (const item of NAV_ITEMS) {
      expect(item.label).not.toMatch(emoji)
      expect(item.icon).toMatch(/^\/assets\/icons\/[a-z-]+\.svg$/)
      const iconPath = resolve('miniprogram', item.icon.replace(/^\//, ''))
      expect(existsSync(iconPath), `${item.icon} must be bundled locally`).toBe(true)
      const svg = readFileSync(iconPath, 'utf8')
      expect(svg).toContain('<svg')
      expect(svg).toContain('fill="none"')
      expect(svg).not.toMatch(/<text|(?:href|src)=["']https?:\/\//)
    }
  })

  test('keeps tab targets at least 44px on narrow screens and reserves the safe area', () => {
    const styles = readFileSync(
      resolve('miniprogram/components/app-tab-bar/index.wxss'),
      'utf8',
    )

    expect(styles).toMatch(/\.tab-item\s*\{[^}]*min-width:\s*44px;/s)
    expect(styles).toMatch(/\.tab-item\s*\{[^}]*min-height:\s*44px;/s)
    expect(styles).toContain('env(safe-area-inset-bottom)')
  })

  test('uses the accessible existing secondary text token for inactive tabs', () => {
    const styles = readFileSync(
      resolve('miniprogram/components/app-tab-bar/index.wxss'),
      'utf8',
    )
    const theme = readFileSync(resolve('miniprogram/styles/theme.wxss'), 'utf8')
    const secondary = theme.match(/--color-text-secondary:\s*(#[0-9A-F]{6});/i)?.[1]
    if (!secondary) throw new Error('Missing --color-text-secondary')

    const luminance = (hex: string): number => {
      const channels = [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16) / 255)
      const linear = channels.map((value) =>
        value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
      return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722
    }
    const contrast = (luminance('#FFFFFF') + 0.05) / (luminance(secondary) + 0.05)

    expect(styles).toMatch(/\.tab-item\s*\{[^}]*color:\s*var\(--color-text-secondary\);/s)
    expect(contrast).toBeGreaterThanOrEqual(4.5)
  })

  test('keeps password binding progressive and gives TDesign inputs visible native labels', () => {
    const login = readFileSync(resolve('miniprogram/pages/login/index.wxml'), 'utf8')
    const bindingStart = login.indexOf('wx:if="{{showBinding}}"')

    expect(bindingStart).toBeGreaterThan(-1)
    expect(login.indexOf('label="员工账号"')).toBeGreaterThan(bindingStart)
    expect(login.indexOf('label="密码"')).toBeGreaterThan(bindingStart)
    expect(login).not.toContain('<text class="field-label">')
    expect(login).toContain('我确认将当前微信绑定到此员工账号')
    expect(login).toContain('disabled="{{isLoading || !username || !password || !confirmed}}"')
  })
})
