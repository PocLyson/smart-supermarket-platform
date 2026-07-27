import { createCart, type CartStorage } from '../miniprogram/store/cart'

const memoryStorage = (): CartStorage => {
  let value: unknown
  return {
    read: () => value,
    write: (next) => {
      value = next
    },
  }
}

const milk = {
  productId: 1,
  name: '纯牛奶',
  unitPriceCent: 590,
  coverImageUrl: '',
}

describe('local cart', () => {
  it('merges the same product and calculates selected total in cents', () => {
    const cart = createCart(memoryStorage())
    cart.add(milk)
    cart.add(milk)

    expect(cart.items()).toEqual([
      expect.objectContaining({ productId: 1, quantity: 2, selected: true }),
    ])
    expect(cart.selectedTotalCent()).toBe(1180)
  })

  it('never allows quantity below one', () => {
    const cart = createCart(memoryStorage())
    cart.add(milk)

    expect(() => cart.setQuantity(1, 0)).toThrow('商品数量至少为 1')
  })

  it('persists selection and removes only requested products', () => {
    const storage = memoryStorage()
    const cart = createCart(storage)
    cart.add(milk)
    cart.add({ ...milk, productId: 2, name: '面包', unitPriceCent: 450 })
    cart.setSelected(2, false)
    cart.remove([1])

    expect(createCart(storage).items()).toEqual([
      expect.objectContaining({ productId: 2, selected: false }),
    ])
    expect(createCart(storage).selectedTotalCent()).toBe(0)
  })
})
