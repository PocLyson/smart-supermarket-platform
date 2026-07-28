import { readdirSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const heroDirectory = resolve(
  __dirname,
  '..',
  'miniprogram',
  'assets',
  'home',
)

describe('mini program package size', () => {
  it('keeps the home hero asset below 350 KB', () => {
    const heroFiles = readdirSync(heroDirectory).filter((fileName) =>
      fileName.startsWith('navy-fresh-grocery-hero.'),
    )
    const totalBytes = heroFiles.reduce(
      (sum, fileName) =>
        sum + statSync(resolve(heroDirectory, fileName)).size,
      0,
    )

    expect(heroFiles).toHaveLength(1)
    expect(totalBytes).toBeLessThanOrEqual(350 * 1024)
  })
})
