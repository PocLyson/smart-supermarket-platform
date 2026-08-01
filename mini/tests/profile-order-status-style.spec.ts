import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (relativePath: string) =>
  readFileSync(resolve(__dirname, '../miniprogram', relativePath), 'utf8')

describe('profile order status style', () => {
  it('uses the same default color for every order status entry', () => {
    const markup = read('pages/profile/index.wxml')

    expect(markup).not.toContain('order-status-item is-highlight')
  })
})
