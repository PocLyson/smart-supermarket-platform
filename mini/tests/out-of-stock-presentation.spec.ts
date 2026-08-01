import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (relativePath: string) =>
  readFileSync(resolve(__dirname, '../miniprogram', relativePath), 'utf8')

describe('out-of-stock presentation', () => {
  it('marks inventory status on every product list surface', () => {
    for (const page of ['home', 'category', 'search']) {
      const source = read(`pages/${page}/index.ts`)
      const markup = read(`pages/${page}/index.wxml`)
      expect(source).toContain('outOfStock: item.availableStock <= 0')
      expect(markup).toContain('暂时缺货')
      expect(markup).toContain('item.outOfStock')
    }
  })

  it('keeps the product detail add button disabled when stock is empty', () => {
    const source = read('pages/product/index.ts')
    const markup = read('pages/product/index.wxml')

    expect(source).toContain('outOfStock: product.availableStock <= 0')
    expect(markup).toContain('disabled="{{outOfStock}}"')
    expect(markup).toContain("{{outOfStock ? '暂时缺货' : '加入购物车'}}")
  })
})
