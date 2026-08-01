import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { createCatalogService } from '../miniprogram/services/catalog'

const read = (relativePath: string) =>
  readFileSync(resolve(__dirname, '../miniprogram', relativePath), 'utf8')

describe('newly uploaded product visibility', () => {
  it('loads the first backend product page with the zero-based index', () => {
    for (const page of ['home', 'category', 'search']) {
      const source = read(`pages/${page}/index.ts`)
      expect(source).toContain('const page = reset ? 0 : this.data.page')
      expect(source).not.toContain('const page = reset ? 1 : this.data.page')
    }
  })

  it('turns uploaded relative image paths into API image URLs', async () => {
    const get = vi.fn().mockResolvedValue({
      items: [
        {
          id: 31,
          coverImageUrl: '/files/product.jpg',
        },
      ],
      page: 0,
      size: 10,
      total: 1,
    })
    const catalog = createCatalogService({ get })

    const result = await catalog.listProducts({ page: 0, size: 10 })

    expect(result.items[0].coverImageUrl).toBe(
      'http://localhost:8080/files/product.jpg',
    )
  })
})
