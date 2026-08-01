import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (relativePath: string) =>
  readFileSync(resolve(__dirname, '../miniprogram', relativePath), 'utf8')

describe('customer order visibility', () => {
  it('loads the first backend order page with the zero-based index', () => {
    const source = read('pages/orders/index.ts')

    expect(source).toContain('page: 0')
    expect(source).toContain('const page = reset ? 0 : this.data.page')
    expect(source).not.toContain('const page = reset ? 1 : this.data.page')
  })

  it('shows unfinished counts on matching profile shortcuts only', () => {
    const source = read('pages/profile/index.ts')
    const markup = read('pages/profile/index.wxml')
    const styles = read('pages/profile/index.wxss')

    expect(source).toContain('buildActiveOrderCounts')
    expect(markup).not.toContain('class="order-count-badge"')
    expect(markup).toContain(
      'wx:if="{{orderCounts.pendingConfirmation > 0}}"',
    )
    expect(markup).toContain('>{{orderCounts.pendingConfirmation}}</text>')
    expect(markup).toContain('wx:if="{{orderCounts.preparing > 0}}"')
    expect(markup).toContain('>{{orderCounts.preparing}}</text>')
    expect(markup).toContain('wx:if="{{orderCounts.readyForPickup > 0}}"')
    expect(markup).toContain('>{{orderCounts.readyForPickup}}</text>')
    expect(markup).not.toContain('orderCounts.completed')
    expect(styles).toContain('.order-status-badge')
  })
})
