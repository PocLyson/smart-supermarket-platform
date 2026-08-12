import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test, vi } from 'vitest'
import {
  dashboardOrderDestination,
  summarizeActiveOrders,
} from '../miniprogram/types/dashboard'
import { createDashboardService } from '../miniprogram/services/dashboard'

describe('merchant workbench presentation', () => {
  test('summarizes the three staff queues without counting terminal orders', () => {
    expect(summarizeActiveOrders({
      PENDING_CONFIRMATION: 3,
      PREPARING: 2,
      READY_FOR_PICKUP: 1,
      COMPLETED: 8,
      CANCELLED: 4,
    })).toEqual([
      { status: 'PENDING_CONFIRMATION', label: '待接单', count: 3 },
      { status: 'PREPARING', label: '备货中', count: 2 },
      { status: 'READY_FOR_PICKUP', label: '待取货', count: 1 },
    ])
  })

  test('opens a queue with its status filter preserved', () => {
    expect(dashboardOrderDestination('READY_FOR_PICKUP')).toBe(
      '/pages/orders/index?status=READY_FOR_PICKUP',
    )
  })

  test('uses the protected merchant dashboard endpoint', async () => {
    const get = vi.fn().mockResolvedValue({ latestOrders: [] })
    const service = createDashboardService({ get })

    await service.summary()

    expect(get).toHaveBeenCalledWith('/api/merchant-mini/dashboard')
  })

  test('renders recoverable loading, error, and latest-order empty states', () => {
    const markup = readFileSync(
      resolve('miniprogram/pages/workbench/index.wxml'),
      'utf8',
    )

    expect(markup).toContain('wx:if="{{isLoading && !summary}}"')
    expect(markup).toContain('bindtap="retry"')
    expect(markup).toContain('暂时没有最近订单')
    expect(markup).toContain('<app-tab-bar value="workbench" />')
  })

  test('renders the approved operations hierarchy under a custom app header', () => {
    const markup = readFileSync(
      resolve('miniprogram/pages/workbench/index.wxml'),
      'utf8',
    )
    const config = JSON.parse(readFileSync(
      resolve('miniprogram/pages/workbench/index.json'),
      'utf8',
    )) as { navigationStyle?: string }

    expect(config.navigationStyle).toBe('custom')
    expect(markup).toContain('class="workbench-header"')
    expect(markup).toContain('鲁能超市李老家分店')
    expect(markup).toContain('优先处理')
    expect(markup).toContain('扫码核销')
    expect(markup).toContain('商品管理')
    expect(markup).toContain('发布公告')
    expect(markup).toContain('今日概览')
    expect(markup).toContain('全部订单')
  })

  test('keeps every approved workbench shortcut wired to a real tap handler', () => {
    const markup = readFileSync(
      resolve('miniprogram/pages/workbench/index.wxml'),
      'utf8',
    )

    expect(markup).toContain('data-shortcut="verification"')
    expect(markup).toContain('data-shortcut="products"')
    expect(markup).toContain('data-shortcut="announcements"')
    expect(markup.match(/bindtap="onShortcutTap"/g)).toHaveLength(3)
    expect(markup).toContain('bindtap="onAllOrdersTap"')
  })

  test('only shows the immediate-action button when pending orders exist', () => {
    const markup = readFileSync(
      resolve('miniprogram/pages/workbench/index.wxml'),
      'utf8',
    )

    expect(markup).toContain('wx:if="{{index === 0 && item.count > 0}}"')
  })

  test('uses one white background for every priority order row', () => {
    const styles = readFileSync(
      resolve('miniprogram/pages/workbench/index.wxss'),
      'utf8',
    )

    expect(styles).toMatch(/\.priority-row\s*\{[^}]*background:\s*var\(--color-bg-surface\);/s)
    expect(styles).not.toMatch(/\.priority-row--urgent\s*\{/)
  })

  test('keeps the custom header content below the WeChat capsule on device', () => {
    const styles = readFileSync(
      resolve('miniprogram/pages/workbench/index.wxss'),
      'utf8',
    )

    expect(styles).toMatch(/\.workbench-header\s*\{[^}]*min-height:\s*300rpx;/s)
    expect(styles).toMatch(/\.workbench-header\s*\{[^}]*padding:\s*calc\(112rpx \+ env\(safe-area-inset-top\)\)/s)
    expect(styles).toMatch(/\.employee-pill\s*\{[^}]*font-size:\s*24rpx;/s)
  })

  test('shows the employee identity without a border or trailing arrow', () => {
    const markup = readFileSync(
      resolve('miniprogram/pages/workbench/index.wxml'),
      'utf8',
    )
    const styles = readFileSync(
      resolve('miniprogram/pages/workbench/index.wxss'),
      'utf8',
    )

    expect(markup).not.toContain('employee-pill__arrow')
    expect(styles).toMatch(/\.employee-pill\s*\{[^}]*border:\s*0;/s)
  })

  test('uses class selectors that compile without page WXSS warnings', () => {
    const styles = readFileSync(
      resolve('miniprogram/pages/workbench/index.wxss'),
      'utf8',
    )

    expect(styles).not.toMatch(/\.priority-row__icon[^,{]*\s+image\s*\{/)
    expect(styles).toContain('.priority-icon-image {')
  })

  test('uses the accessible secondary token for small order metadata', () => {
    const styles = readFileSync(
      resolve('miniprogram/pages/workbench/index.wxss'),
      'utf8',
    )
    const theme = readFileSync(resolve('miniprogram/styles/theme.wxss'), 'utf8')
    const token = styles.match(/\.order-customer,\s*\.order-time\s*\{[^}]*color:\s*var\((--[\w-]+)\);/s)?.[1]
    const hex = token
      ? theme.match(new RegExp(`${token}:\\s*(#[0-9A-F]{6});`, 'i'))?.[1]
      : undefined
    if (!token || !hex) throw new Error('Order metadata must resolve to a theme color')
    const luminance = (value: string): number => {
      const channels = [1, 3, 5].map((start) => Number.parseInt(value.slice(start, start + 2), 16) / 255)
      const linear = channels.map((channel) =>
        channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
      return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722
    }
    const contrast = (luminance('#FFFFFF') + 0.05) / (luminance(hex) + 0.05)

    expect(token).toBe('--color-text-secondary')
    expect(contrast).toBeGreaterThanOrEqual(4.5)
  })

  test('separates recent orders into readable cards with a local chevron', () => {
    const markup = readFileSync(
      resolve('miniprogram/pages/workbench/index.wxml'),
      'utf8',
    )
    const styles = readFileSync(
      resolve('miniprogram/pages/workbench/index.wxss'),
      'utf8',
    )

    expect(markup).toContain('class="order-row__arrow-icon"')
    expect(markup).toContain('/assets/icons/chevron-right.svg')
    expect(markup).not.toContain('class="order-row__arrow">›</text>')
    expect(markup).toContain('class="order-recipient">收件人：{{item.pickupName}}</text>')
    expect(markup).not.toContain('class="order-no">#{{item.orderNo}}</text>')
    expect(styles).toMatch(/\.order-list\s*\{[^}]*background:\s*transparent;[^}]*gap:\s*16rpx;/s)
    expect(styles).toMatch(/\.order-row\s*\{[^}]*display:\s*grid;[^}]*border-radius:\s*24rpx;/s)
    expect(styles).toMatch(/\.order-recipient\s*\{[^}]*text-overflow:\s*ellipsis;[^}]*white-space:\s*nowrap;/s)
  })
})
