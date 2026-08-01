import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const { cartMock, sessionCurrent } = vi.hoisted(() => ({
  cartMock: {
    add: vi.fn(),
    items: vi.fn(() => []),
    selectedItems: vi.fn(() => [{ productId: 1 }]),
    selectedTotalCent: vi.fn(() => 990),
    setSelected: vi.fn(),
    setQuantity: vi.fn(),
    remove: vi.fn(),
  },
  sessionCurrent: vi.fn(),
}))

vi.mock('../miniprogram/store/cart', () => ({ cart: cartMock }))
vi.mock('../miniprogram/store/session', () => ({
  sessionStore: { current: sessionCurrent },
}))
vi.mock('../miniprogram/services/catalog', () => ({
  catalogService: {
    getProduct: vi.fn(),
  },
}))

type ProductPageOptions = {
  onAddToCart(): void
}

type CartPageOptions = {
  onCheckout(): void
}

let productPage: ProductPageOptions
let cartPage: CartPageOptions

beforeAll(async () => {
  ;(globalThis as unknown as { Page: typeof Page }).Page = ((
    options: ProductPageOptions,
  ) => {
    productPage = options
  }) as unknown as typeof Page
  await import('../miniprogram/pages/product/index')

  ;(globalThis as unknown as { Page: typeof Page }).Page = ((
    options: CartPageOptions,
  ) => {
    cartPage = options
  }) as unknown as typeof Page
  await import('../miniprogram/pages/cart/index')
})

beforeEach(() => {
  sessionCurrent.mockReset()
  sessionCurrent.mockReturnValue(undefined)
  cartMock.add.mockClear()
  cartMock.selectedItems.mockReturnValue([{ productId: 1 }])
  vi.stubGlobal('wx', {
    showModal: vi.fn(),
    showToast: vi.fn(),
    navigateTo: vi.fn(),
  })
})

describe('shopping authentication guard', () => {
  it('does not add a product while logged out', () => {
    productPage.onAddToCart.call({
      data: {
        product: {
          id: 1,
          name: '测试商品',
          coverImageUrl: '',
          priceCent: 990,
        },
        outOfStock: false,
        quantity: 1,
      },
    })

    expect(cartMock.add).not.toHaveBeenCalled()
    expect(wx.showModal).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '登录后继续',
        confirmText: '去登录',
      }),
    )
  })

  it('does not enter checkout while logged out', () => {
    cartPage.onCheckout()

    expect(wx.navigateTo).not.toHaveBeenCalledWith({
      url: '/pages/checkout/index',
    })
    expect(wx.showModal).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '登录后继续',
        confirmText: '去登录',
      }),
    )
  })
})
