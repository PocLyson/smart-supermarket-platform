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

  test('uses the accessible secondary token for the small metric unit text', () => {
    const styles = readFileSync(
      resolve('miniprogram/pages/workbench/index.wxss'),
      'utf8',
    )
    const theme = readFileSync(resolve('miniprogram/styles/theme.wxss'), 'utf8')
    const token = styles.match(/\.metric-unit\s*\{[^}]*color:\s*var\((--[\w-]+)\);/s)?.[1]
    const hex = token
      ? theme.match(new RegExp(`${token}:\\s*(#[0-9A-F]{6});`, 'i'))?.[1]
      : undefined
    if (!token || !hex) throw new Error('Metric unit must resolve to a theme color')
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
})
