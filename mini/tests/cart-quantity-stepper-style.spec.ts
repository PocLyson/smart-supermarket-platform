import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (relativePath: string) =>
  readFileSync(resolve(__dirname, '../miniprogram', relativePath), 'utf8')

describe('cart quantity stepper style', () => {
  it('vertically centers the decrease, value, and increase controls', () => {
    const styles = read('pages/cart/index.wxss')

    expect(styles).toMatch(
      /\.quantity-button\s*\{[\s\S]*?display:\s*flex;[\s\S]*?height:\s*72rpx;[\s\S]*?margin:\s*0;[\s\S]*?line-height:\s*1;[\s\S]*?align-items:\s*center;[\s\S]*?justify-content:\s*center;/,
    )
    expect(styles).toMatch(
      /\.quantity-value\s*\{[\s\S]*?display:\s*flex;[\s\S]*?height:\s*72rpx;[\s\S]*?align-items:\s*center;[\s\S]*?justify-content:\s*center;/,
    )
  })
})
