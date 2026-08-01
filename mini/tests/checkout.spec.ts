import { NetworkUncertainError } from '../miniprogram/services/http'
import { createCheckout } from '../miniprogram/store/checkout'

const selectedItems = [
  {
    productId: 1,
    name: '纯牛奶',
    coverImageUrl: '',
    unitPriceCent: 590,
    quantity: 2,
    selected: true,
  },
]

const orderItems = [
  {
    productId: 1,
    productName: '纯牛奶',
    unitPriceCent: 590,
    quantity: 2,
    subtotalCent: 1180,
  },
]

const setup = () => {
  let persistedPending: unknown
  const pendingStorage = {
    read: vi.fn(() => persistedPending),
    write: vi.fn((value: unknown) => {
      persistedPending = value
    }),
    clear: vi.fn(() => {
      persistedPending = undefined
    }),
  }
  const auth = {
    ensureSession: vi.fn().mockResolvedValue({ accessToken: 'customer-token' }),
  }
  const profile = { save: vi.fn().mockResolvedValue(undefined) }
  const orders = {
    create: vi.fn().mockResolvedValue({
      orderNo: '202607280001',
      status: 'PENDING_CONFIRMATION' as const,
      paymentStatus: 'UNPAID' as const,
      pickupName: '李先生',
      phone: '13800138000',
      totalCent: 1180,
      items: orderItems,
      history: [],
    }),
    list: vi.fn().mockResolvedValue({
      items: [],
      page: 1,
      size: 20,
      total: 0,
    }),
  }
  const cart = {
    selectedItems: vi.fn(() => selectedItems),
    remove: vi.fn(),
  }
  const checkout = createCheckout({
    auth,
    profile,
    orders,
    cart,
    pendingStorage,
    createIdempotencyKey: () => '123e4567-e89b-42d3-a456-426614174000',
  })
  checkout.updateContact({
    pickupName: '李先生',
    phone: '13800138000',
  })
  return { checkout, auth, profile, orders, cart, pendingStorage }
}

describe('checkout', () => {
  it('logs in, saves contact data, and submits selected cart items once', async () => {
    const { checkout, auth, profile, orders, cart } = setup()
    checkout.updateCustomerNote('  饮料要常温  ')

    const result = await checkout.submit()

    expect(auth.ensureSession).toHaveBeenCalledTimes(1)
    expect(profile.save).toHaveBeenCalledWith({
      pickupName: '李先生',
      phone: '13800138000',
    })
    expect(orders.create).toHaveBeenCalledWith(
      '123e4567-e89b-42d3-a456-426614174000',
      {
        pickupName: '李先生',
        phone: '13800138000',
        customerNote: '饮料要常温',
        items: [{ productId: 1, quantity: 2 }],
      },
    )
    expect(cart.remove).toHaveBeenCalledWith([1])
    expect(result.orderNo).toBe('202607280001')
  })

  it('does not reuse a successful order note for the next order', async () => {
    const { checkout, orders } = setup()
    checkout.updateCustomerNote('第一单备注')

    await checkout.submit()
    await checkout.submit()

    expect(
      orders.create.mock.calls.map(([, request]) => request.customerNote),
    ).toEqual(['第一单备注', undefined])
  })

  it('accepts one hundred effective characters surrounded by whitespace', async () => {
    const { checkout, orders } = setup()
    const note = '备'.repeat(100)
    checkout.updateCustomerNote(`  ${note}  `)

    await checkout.submit()

    expect(orders.create.mock.calls[0][1].customerNote).toBe(note)
  })

  it('rejects a note with one hundred and one effective characters', async () => {
    const { checkout, orders } = setup()
    checkout.updateCustomerNote(`  ${'备'.repeat(101)}  `)

    await expect(checkout.submit()).rejects.toThrow(
      '订单备注不能超过 100 个字符',
    )
    expect(orders.create).not.toHaveBeenCalled()
  })

  it('rejects an invalid pickup contact before creating an order', async () => {
    const { checkout, orders } = setup()
    checkout.updateContact({ pickupName: ' ', phone: '123' })

    await expect(checkout.submit()).rejects.toThrow('请填写取货人姓名')
    expect(orders.create).not.toHaveBeenCalled()
  })

  it('retains the idempotency key across uncertain network retries', async () => {
    const { checkout, orders } = setup()
    checkout.updateCustomerNote('饮料要常温')
    orders.create
      .mockRejectedValueOnce(new NetworkUncertainError())
      .mockResolvedValueOnce({
        orderNo: '202607280001',
        status: 'PENDING_CONFIRMATION',
        paymentStatus: 'UNPAID',
        pickupName: '李先生',
        phone: '13800138000',
        totalCent: 1180,
        items: orderItems,
        history: [],
      })

    await expect(checkout.submit()).rejects.toThrow('订单结果尚未确认')
    expect(orders.list).toHaveBeenCalledTimes(1)

    checkout.updateCustomerNote('改'.repeat(101))
    await checkout.submit()

    expect(orders.create.mock.calls.map(([key]) => key)).toEqual([
      '123e4567-e89b-42d3-a456-426614174000',
      '123e4567-e89b-42d3-a456-426614174000',
    ])
    expect(orders.create.mock.calls.map(([, request]) => request.customerNote)).toEqual([
      '饮料要常温',
      '饮料要常温',
    ])
  })

  it('does not mistake an older identical order for the uncertain submission', async () => {
    const { checkout, orders, cart } = setup()
    orders.create.mockRejectedValueOnce(new NetworkUncertainError())
    orders.list.mockResolvedValueOnce({
      items: [
        {
          orderNo: '202607270001',
          status: 'COMPLETED',
          paymentStatus: 'PAID',
          pickupName: '李先生',
          phone: '13800138000',
          totalCent: 1180,
          items: orderItems,
          history: [],
          createdAt: '2026-07-27T10:00:00+08:00',
        },
      ],
      page: 1,
      size: 20,
      total: 1,
    })

    await expect(checkout.submit()).rejects.toThrow('订单结果尚未确认')
    expect(cart.remove).not.toHaveBeenCalled()
  })

  it('uses a fresh idempotency key after a definitive business failure', async () => {
    const { auth, profile, orders, cart } = setup()
    const keys = [
      '123e4567-e89b-42d3-a456-426614174000',
      '223e4567-e89b-42d3-a456-426614174000',
    ]
    const checkout = createCheckout({
      auth,
      profile,
      orders,
      cart,
      createIdempotencyKey: () => keys.shift() ?? 'unexpected',
      pendingStorage: {
        read: () => undefined,
        write: vi.fn(),
        clear: vi.fn(),
      },
    })
    checkout.updateContact({
      pickupName: '李先生',
      phone: '13800138000',
    })
    orders.create.mockRejectedValueOnce(new Error('库存不足'))

    await expect(checkout.submit()).rejects.toThrow('库存不足')
    await checkout.submit()

    expect(orders.create.mock.calls.map(([key]) => key)).toEqual([
      '123e4567-e89b-42d3-a456-426614174000',
      '223e4567-e89b-42d3-a456-426614174000',
    ])
  })

  it('keeps stale-cart items when checkout rejects an archived product', async () => {
    const { checkout, orders, cart } = setup()
    const message = '部分商品已下架，请移除后重试'
    orders.create.mockRejectedValueOnce(new Error(message))

    await expect(checkout.submit()).rejects.toThrow(message)

    expect(cart.remove).not.toHaveBeenCalled()
  })

  it('restores the original request and key after an app restart', async () => {
    const {
      checkout,
      auth,
      profile,
      orders,
      cart,
      pendingStorage,
    } = setup()
    orders.create.mockRejectedValueOnce(new NetworkUncertainError())

    await expect(checkout.submit()).rejects.toThrow('订单结果尚未确认')

    cart.selectedItems.mockReturnValue([
      {
        productId: 2,
        name: '面包',
        coverImageUrl: '',
        unitPriceCent: 450,
        quantity: 1,
        selected: true,
      },
    ])
    const restored = createCheckout({
      auth,
      profile,
      orders,
      cart,
      pendingStorage,
      createIdempotencyKey: () => 'new-key-must-not-be-used',
    })
    restored.updateContact({
      pickupName: '王女士',
      phone: '13900139000',
    })

    await restored.submit()

    expect(orders.create).toHaveBeenLastCalledWith(
      '123e4567-e89b-42d3-a456-426614174000',
      {
        pickupName: '李先生',
        phone: '13800138000',
        items: [{ productId: 1, quantity: 2 }],
      },
    )
    expect(cart.remove).toHaveBeenLastCalledWith([1])
    expect(pendingStorage.clear).toHaveBeenCalled()
  })
})
