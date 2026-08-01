import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const { cartAdd, requireCustomerLogin } = vi.hoisted(() => ({
  cartAdd: vi.fn(),
  requireCustomerLogin: vi.fn(() => true),
}))

vi.mock('../miniprogram/store/cart', () => ({
  cart: { add: cartAdd },
}))
vi.mock('../miniprogram/utils/auth-guard', () => ({
  requireCustomerLogin,
}))
vi.mock('../miniprogram/services/catalog', () => ({
  catalogService: {
    listCategories: vi.fn(),
    listProducts: vi.fn(),
  },
}))

type ProductListPage = {
  onQuickAdd(event: WechatMiniprogram.TouchEvent): void
}

let homePage: ProductListPage
let categoryPage: ProductListPage

const read = (relativePath: string) =>
  readFileSync(resolve(__dirname, '../miniprogram', relativePath), 'utf8')

beforeAll(async () => {
  ;(globalThis as unknown as { Page: typeof Page }).Page = ((
    options: ProductListPage,
  ) => {
    homePage = options
  }) as unknown as typeof Page
  await import('../miniprogram/pages/home/index')

  ;(globalThis as unknown as { Page: typeof Page }).Page = ((
    options: ProductListPage,
  ) => {
    categoryPage = options
  }) as unknown as typeof Page
  await import('../miniprogram/pages/category/index')
})

beforeEach(() => {
  cartAdd.mockClear()
  requireCustomerLogin.mockClear()
  requireCustomerLogin.mockReturnValue(true)
  vi.stubGlobal('wx', {
    showToast: vi.fn(),
    navigateTo: vi.fn(),
  })
})

describe('product card quick add', () => {
  it('uses a non-bubbling quick-add target on home and category cards', () => {
    for (const markup of [
      read('pages/home/index.wxml'),
      read('pages/category/index.wxml'),
    ]) {
      expect(markup).toContain('data-id="{{item.id}}"')
      expect(markup).toContain('catchtap="onQuickAdd"')
      expect(markup).toContain('bindtap="onOpenProduct"')
    }
  })

  it.each([
    ['home', () => homePage],
    ['category', () => categoryPage],
  ])('adds directly from the %s card without opening details', (_, getPage) => {
    const context = {
      data: {
        products: [
          {
            id: 1,
            name: '话梅 100g',
            coverImageUrl: '/images/product.png',
            priceCent: 720,
            availableStock: 6,
          },
        ],
      },
    }
    const event = {
      currentTarget: { dataset: { id: 1 } },
    } as unknown as WechatMiniprogram.TouchEvent

    getPage().onQuickAdd.call(context, event)

    expect(cartAdd).toHaveBeenCalledWith({
      productId: 1,
      name: '话梅 100g',
      coverImageUrl: '/images/product.png',
      unitPriceCent: 720,
    })
    expect(wx.navigateTo).not.toHaveBeenCalled()
    expect(wx.showToast).toHaveBeenCalledWith({
      title: '已加入购物车',
      icon: 'success',
    })
  })

  it.each([
    ['home', () => homePage],
    ['category', () => categoryPage],
  ])('blocks quick add for an out-of-stock product on %s', (_, getPage) => {
    const context = {
      data: {
        products: [
          {
            id: 1,
            name: '缺货商品',
            coverImageUrl: '/images/product.png',
            priceCent: 720,
            availableStock: 0,
          },
        ],
      },
    }

    getPage().onQuickAdd.call(context, {
      currentTarget: { dataset: { id: 1 } },
    } as unknown as WechatMiniprogram.TouchEvent)

    expect(cartAdd).not.toHaveBeenCalled()
    expect(requireCustomerLogin).not.toHaveBeenCalled()
    expect(wx.showToast).toHaveBeenCalledWith({
      title: '库存不足，暂时无法加入购物车',
      icon: 'none',
    })
  })
})
