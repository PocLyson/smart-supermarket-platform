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

const setup = () => {
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
      items: selectedItems,
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
    createIdempotencyKey: () => '123e4567-e89b-42d3-a456-426614174000',
  })
  checkout.updateContact({
    pickupName: '李先生',
    phone: '13800138000',
  })
  return { checkout, auth, profile, orders, cart }
}

describe('checkout', () => {
  it('logs in, saves contact data, and submits selected cart items once', async () => {
    const { checkout, auth, profile, orders, cart } = setup()

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
        items: [{ productId: 1, quantity: 2 }],
      },
    )
    expect(cart.remove).toHaveBeenCalledWith([1])
    expect(result.orderNo).toBe('202607280001')
  })

  it('rejects an invalid pickup contact before creating an order', async () => {
    const { checkout, orders } = setup()
    checkout.updateContact({ pickupName: ' ', phone: '123' })

    await expect(checkout.submit()).rejects.toThrow('请填写取货人姓名')
    expect(orders.create).not.toHaveBeenCalled()
  })

  it('retains the idempotency key across uncertain network retries', async () => {
    const { checkout, orders } = setup()
    orders.create
      .mockRejectedValueOnce(new NetworkUncertainError())
      .mockResolvedValueOnce({
        orderNo: '202607280001',
        status: 'PENDING_CONFIRMATION',
        paymentStatus: 'UNPAID',
        pickupName: '李先生',
        phone: '13800138000',
        totalCent: 1180,
        items: selectedItems,
        history: [],
      })

    await expect(checkout.submit()).rejects.toThrow('订单结果尚未确认')
    expect(orders.list).toHaveBeenCalledTimes(1)

    await checkout.submit()

    expect(orders.create.mock.calls.map(([key]) => key)).toEqual([
      '123e4567-e89b-42d3-a456-426614174000',
      '123e4567-e89b-42d3-a456-426614174000',
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
          items: selectedItems,
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
})
