import { createCatalogService } from '../miniprogram/services/catalog'

describe('catalog service', () => {
  it('uses the frozen mini catalog paths and forwards pagination filters', async () => {
    const get = vi.fn().mockResolvedValue({
      items: [],
      page: 2,
      size: 10,
      total: 0,
    })
    const catalog = createCatalogService({ get })

    await catalog.listCategories()
    await catalog.listProducts({
      categoryId: 3,
      keyword: '牛奶',
      page: 2,
      size: 10,
    })
    await catalog.getProduct(8)

    expect(get.mock.calls).toEqual([
      ['/api/mini/categories'],
      [
        '/api/mini/products',
        { categoryId: 3, keyword: '牛奶', page: 2, size: 10 },
      ],
      ['/api/mini/products/8'],
    ])
  })
})
