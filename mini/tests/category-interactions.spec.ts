import { afterEach, describe, expect, it, vi } from 'vitest'

describe('category interactions', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('stores null instead of undefined when selecting all products', async () => {
    let pageDefinition: Record<string, unknown> | undefined
    vi.stubGlobal('Page', (definition: Record<string, unknown>) => {
      pageDefinition = definition
    })

    await import('../miniprogram/pages/category/index')

    const setData = vi.fn()
    const loadProducts = vi.fn()
    const onSelectCategory = pageDefinition?.onSelectCategory as
      | ((this: unknown, event: { currentTarget: { dataset: object } }) => void)
      | undefined

    expect(onSelectCategory).toBeTypeOf('function')
    onSelectCategory?.call(
      {
        data: { categories: [] },
        setData,
        loadProducts,
      },
      {
        currentTarget: {
          dataset: { id: 'all' },
        },
      },
    )

    expect(setData).toHaveBeenCalledWith({
      selectedCategoryId: null,
      selectedCategoryName: '全部商品',
    })
    expect(loadProducts).toHaveBeenCalledWith(true)
  })
})
