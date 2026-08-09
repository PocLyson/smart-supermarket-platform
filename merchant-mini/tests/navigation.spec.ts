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
      for (const extension of ['ts', 'wxml', 'wxss']) {
        expect(
          existsSync(resolve('miniprogram', `${pagePath}/index.${extension}`)),
          `${pagePath}/index.${extension} must exist`,
        ).toBe(true)
      }
    }
  })
})
