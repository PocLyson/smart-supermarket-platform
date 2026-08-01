import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const styles = readFileSync(
  resolve(__dirname, '../miniprogram/pages/legal/index.wxss'),
  'utf8',
)

describe('legal document typography', () => {
  it('uses compact, left-aligned typography for both legal documents', () => {
    expect(styles).toMatch(
      /\.legal-title\s*\{[\s\S]*?font-size:\s*40rpx;[\s\S]*?line-height:\s*56rpx;[\s\S]*?\}/,
    )
    expect(styles).toMatch(
      /\.section-title\s*\{[\s\S]*?font-size:\s*32rpx;[\s\S]*?line-height:\s*46rpx;[\s\S]*?\}/,
    )
    expect(styles).toMatch(
      /\.section-paragraph\s*\{[\s\S]*?font-size:\s*28rpx;[\s\S]*?line-height:\s*46rpx;[\s\S]*?letter-spacing:\s*0;[\s\S]*?text-align:\s*left;[\s\S]*?\}/,
    )
    expect(styles).not.toContain('text-align: justify')
  })
})
