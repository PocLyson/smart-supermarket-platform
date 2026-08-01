import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createCatalogService } from '../miniprogram/services/catalog'

const { listCategories, listProducts } = vi.hoisted(() => ({
  listCategories: vi.fn(),
  listProducts: vi.fn(),
}))

vi.mock('../miniprogram/services/catalog', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('../miniprogram/services/catalog')
  >()
  return {
    ...actual,
    catalogService: { listCategories, listProducts },
  }
})

const read = (relativePath: string) =>
  readFileSync(resolve(__dirname, '../miniprogram', relativePath), 'utf8')

interface VisibleProduct {
  id: number
  name: string
  categoryId: number
  categoryName: string
  priceCent: number
  unit: string
  coverImageUrl: string
  onShelf: boolean
  availableStock: number
  displayPrice?: string
  outOfStock?: boolean
}

interface CategoryPageData {
  selectedCategoryId: number | null
  products: VisibleProduct[]
  page: number
  loading: boolean
  error: string
  empty: boolean
  reachedEnd: boolean
}

interface CategoryPageContext {
  data: CategoryPageData
  setData(update: Partial<CategoryPageData>): void
}

interface CategoryVisibilityPage {
  loadProducts(this: CategoryPageContext, reset: boolean): Promise<void>
}

let categoryPage: CategoryVisibilityPage

beforeAll(async () => {
  ;(globalThis as unknown as { Page: typeof Page }).Page = ((
    options: CategoryVisibilityPage,
  ) => {
    categoryPage = options
  }) as unknown as typeof Page
  await import('../miniprogram/pages/category/index')
})

beforeEach(() => {
  listCategories.mockReset()
  listProducts.mockReset()
})

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

  it('does not retain a product after the public catalog stops returning it', async () => {
    const get = vi
      .fn()
      .mockResolvedValueOnce({
        items: [
          {
            id: 10,
            name: '无糖乌龙茶 500ml',
            coverImageUrl: '/files/oolong-tea.webp',
          },
        ],
        page: 0,
        size: 10,
        total: 1,
      })
      .mockResolvedValueOnce({
        items: [],
        page: 0,
        size: 10,
        total: 0,
      })
    const catalog = createCatalogService({ get })

    const beforeArchive = await catalog.listProducts({ page: 0, size: 10 })
    const afterArchive = await catalog.listProducts({ page: 0, size: 10 })

    expect(beforeArchive.items).toHaveLength(1)
    expect(afterArchive.items).toEqual([])
    expect(afterArchive.total).toBe(0)
  })

  it('removes a missing product from the category page after a reset reload', async () => {
    const product: VisibleProduct = {
      id: 10,
      name: '无糖乌龙茶 500ml',
      categoryId: 1,
      categoryName: '饮料',
      priceCent: 500,
      unit: '瓶',
      coverImageUrl: '/files/oolong-tea.webp',
      onShelf: true,
      availableStock: 9,
    }
    listProducts
      .mockResolvedValueOnce({
        items: [product],
        page: 0,
        size: 12,
        total: 1,
      })
      .mockResolvedValueOnce({
        items: [],
        page: 0,
        size: 12,
        total: 0,
      })
    const context: CategoryPageContext = {
      data: {
        selectedCategoryId: null,
        products: [],
        page: 0,
        loading: false,
        error: '',
        empty: false,
        reachedEnd: false,
      },
      setData(update) {
        Object.assign(this.data, update)
      },
    }

    await categoryPage.loadProducts.call(context, true)
    expect(context.data.products.map((item) => item.id)).toEqual([10])

    await categoryPage.loadProducts.call(context, true)

    expect(context.data.products).toEqual([])
    expect(context.data.empty).toBe(true)
    expect(context.data.reachedEnd).toBe(true)
  })
})
