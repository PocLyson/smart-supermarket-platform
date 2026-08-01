import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (relativePath: string) =>
  readFileSync(resolve(__dirname, '../miniprogram', relativePath), 'utf8')

describe('compact mini-program UI adjustments', () => {
  it('uses a compact end-of-orders message instead of a full empty-state panel', () => {
    const markup = read('pages/orders/index.wxml')
    const styles = read('pages/orders/index.wxss')

    expect(markup).toContain('class="state-panel orders-end"')
    expect(styles).toMatch(
      /\.orders-end\s*\{[\s\S]*?padding:\s*20rpx[\s\S]*?font-size:\s*24rpx;[\s\S]*?line-height:\s*36rpx;/,
    )
  })

  it('uses an inset pill action in the category search control', () => {
    const styles = read('pages/category/index.wxss')

    expect(styles).toMatch(
      /\.category-search-action\s*\{[\s\S]*?width:\s*132rpx;[\s\S]*?min-height:\s*80rpx;[\s\S]*?margin:\s*6rpx;[\s\S]*?border-radius:\s*var\(--radius-round\);/,
    )
  })
})
