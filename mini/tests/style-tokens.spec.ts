import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('page style tokens', () => {
  it('uses defined theme variables so controls keep their visible styles', () => {
    const theme = readFileSync(
      resolve(__dirname, '../miniprogram/styles/theme.wxss'),
      'utf8',
    )
    const authStyles = readFileSync(
      resolve(__dirname, '../miniprogram/pages/auth/index.wxss'),
      'utf8',
    )
    const definedTokens = new Set(
      [...theme.matchAll(/(--[\w-]+)\s*:/g)].map((match) => match[1]),
    )
    const referencedTokens = [
      ...authStyles.matchAll(/var\((--[\w-]+)(?:\s*,[^)]*)?\)/g),
    ].map((match) => match[1])

    expect(
      referencedTokens.filter((token) => !definedTokens.has(token)),
    ).toEqual([])
  })
})
