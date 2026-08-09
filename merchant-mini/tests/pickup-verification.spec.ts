import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { createOrdersService } from '../miniprogram/services/orders'
import type { MerchantOrder } from '../miniprogram/types/order'

const orderService = vi.hoisted(() => ({
  detail: vi.fn(),
  verifyPickup: vi.fn(),
}))

vi.mock('../miniprogram/services/orders', async (importOriginal) => {
  const original = await importOriginal<typeof import('../miniprogram/services/orders')>()
  return { ...original, merchantOrdersService: orderService }
})

const order = (overrides: Partial<MerchantOrder> = {}): MerchantOrder => ({
  orderNo: 'ORD-20260809-1',
  totalCent: 2590,
  status: 'READY_FOR_PICKUP',
  paymentStatus: 'UNPAID',
  paymentMethod: null,
  pickupName: '张先生',
  phone: '13800138000',
  customerNote: null,
  cancelledBy: null,
  cancelReason: null,
  createdAt: '2026-08-09T08:00:00Z',
  items: [{
    productId: 1,
    productName: '鲜牛奶',
    unit: '盒',
    unitPriceCent: 1295,
    quantity: 2,
    subtotalCent: 2590,
  }],
  history: [],
  ...overrides,
})

afterEach(() => {
  vi.unstubAllGlobals()
})

beforeEach(() => {
  vi.resetModules()
  orderService.detail.mockReset()
  orderService.verifyPickup.mockReset()
})

describe('pickup code and payment rules', () => {
  test('accepts only a plain six-digit pickup code', async () => {
    const { parsePickupScan } = await import('../miniprogram/pages/verify-pickup/verification')

    expect(parsePickupScan('473898')).toEqual({ pickupCode: '473898' })
    expect(parsePickupScan(' 473898 ')).toEqual({ pickupCode: '473898' })
    for (const invalid of ['12', '47389A', '{"pickupCode":"473898"}', 'https://x/473898']) {
      expect(() => parsePickupScan(invalid)).toThrow('请输入6位取货码')
    }
  })

  test('requires a supported collection method only for unpaid orders', async () => {
    const { paymentOptionsFor, resolvePayAtStoreMethod } = await import(
      '../miniprogram/pages/verify-pickup/verification'
    )

    expect(paymentOptionsFor('PAID')).toEqual([])
    expect(paymentOptionsFor('UNPAID')).toEqual(['CASH', 'WECHAT_QR'])
    expect(() => resolvePayAtStoreMethod(order(), '')).toThrow('请选择收款方式')
    expect(resolvePayAtStoreMethod(order(), 'CASH')).toBe('CASH')
    expect(resolvePayAtStoreMethod(order({ paymentStatus: 'PAID', paymentMethod: 'WECHAT_QR' }), '')).toBe('WECHAT_QR')
  })
})

describe('pickup verification API boundary', () => {
  test('posts the code and collection method to the encoded order endpoint', async () => {
    const post = vi.fn().mockResolvedValue(order({ status: 'COMPLETED', paymentStatus: 'PAID' }))
    const service = createOrdersService({ get: vi.fn(), post })

    await service.verifyPickup('ORD/2026 1', '473898', 'CASH')

    expect(post).toHaveBeenCalledWith(
      '/api/merchant-mini/orders/ORD%2F2026%201/verify-pickup',
      { pickupCode: '473898', payAtStoreMethod: 'CASH' },
    )
  })
})

describe('pickup verification page flow', () => {
  const loadPage = async () => {
    const registerPage = vi.fn()
    vi.stubGlobal('Page', registerPage)
    await import('../miniprogram/pages/verify-pickup/index')
    return registerPage.mock.calls[0][0] as Record<string, (...args: never[]) => unknown>
  }

  const pageContext = (definition: Record<string, unknown>) => ({
    data: { ...(definition.data as Record<string, unknown>) },
    setData(values: Record<string, unknown>) {
      Object.assign(this.data, values)
    },
    getOpenerEventChannel: () => ({ emit: vi.fn() }),
  })

  test('rejects a malformed scan locally without fetching an order', async () => {
    vi.stubGlobal('wx', {
      scanCode: ({ success }: { success(result: { result: string }): void }) => success({ result: 'signed:473898' }),
    })
    const definition = await loadPage()
    const context = pageContext(definition)

    await definition.scanPickup.call(context)

    expect(context.data.errorMessage).toBe('请输入6位取货码')
    expect(context.data.stage).toBe('INPUT')
    expect(orderService.detail).not.toHaveBeenCalled()
  })

  test('shows a read-only preview before an explicitly confirmed mutation', async () => {
    const preview = order({ paymentStatus: 'PAID', paymentMethod: 'WECHAT_QR' })
    const completed = order({
      paymentStatus: 'PAID',
      paymentMethod: 'WECHAT_QR',
      status: 'COMPLETED',
    })
    orderService.detail.mockResolvedValue(preview)
    orderService.verifyPickup.mockResolvedValue(completed)
    vi.stubGlobal('wx', {
      showModal: ({ success }: { success(result: { confirm: boolean }): void }) => success({ confirm: true }),
      showToast: vi.fn(),
    })
    const definition = await loadPage()
    const context = pageContext(definition)
    Object.assign(context.data, {
      orderNo: preview.orderNo,
      pickupCode: '473898',
    })

    await definition.loadPreview.call(context)
    expect(context.data.stage).toBe('CONFIRM')
    expect(context.data.preview).toMatchObject({
      orderNo: preview.orderNo,
      maskedPickupName: '张**',
      maskedPhone: '138****8000',
      amountText: '¥25.90',
      paymentLabel: '已付款',
    })
    expect(orderService.verifyPickup).not.toHaveBeenCalled()

    await definition.confirmPickup.call(context)
    expect(context.data.stage).toBe('SUCCESS')
    expect(context.data.isSubmitting).toBe(false)
    expect(context.data.completedOrder).toEqual(completed)
  })

  test('keeps invalid-code failures recoverable and never presents success', async () => {
    orderService.detail.mockResolvedValue(order())
    orderService.verifyPickup.mockRejectedValue(
      Object.assign(new Error('取货码不正确，请与顾客核对后重试'), {
        code: 'PICKUP_CODE_MISMATCH',
      }),
    )
    vi.stubGlobal('wx', {
      showModal: ({ success }: { success(result: { confirm: boolean }): void }) => success({ confirm: true }),
    })
    const definition = await loadPage()
    const context = pageContext(definition)
    Object.assign(context.data, {
      orderNo: 'ORD-20260809-1',
      pickupCode: '000000',
    })

    await definition.loadPreview.call(context)
    context.data.selectedPaymentMethod = 'CASH'
    await definition.confirmPickup.call(context)

    expect(context.data.stage).toBe('CONFIRM')
    expect(context.data.completedOrder).toBeNull()
    expect(context.data.errorMessage).toContain('请与顾客核对后重试')
    expect(context.data.isSubmitting).toBe(false)
  })

  test('starts continued verification with a clean history after entry from detail', async () => {
    const reLaunch = vi.fn()
    vi.stubGlobal('wx', { reLaunch })
    const definition = await loadPage()
    const context = pageContext(definition)
    Object.assign(context.data, {
      stage: 'SUCCESS',
      openedFromDetail: true,
      completedOrder: order({ status: 'COMPLETED' }),
    })

    definition.continueVerification.call(context)

    expect(reLaunch).toHaveBeenCalledWith({ url: '/pages/verify-pickup/index' })
  })

  test('renders payment choice only for unpaid previews and exposes recoverable success actions', () => {
    const markup = readFileSync(resolve('miniprogram/pages/verify-pickup/index.wxml'), 'utf8')
    const styles = readFileSync(resolve('miniprogram/pages/verify-pickup/index.wxss'), 'utf8')

    expect(markup).toContain("wx:if=\"{{preview.paymentStatus === 'UNPAID'}}\"")
    expect(markup).toContain('确认核销')
    expect(markup).toContain('继续核销')
    expect(markup).toContain('查看订单')
    expect(markup).toContain('loading="{{isSubmitting}}"')
    expect(markup).toContain("disabled=\"{{isSubmitting || (preview.paymentStatus === 'UNPAID' && !selectedPaymentMethod)}}\"")
    expect(styles).toContain('env(safe-area-inset-bottom)')
    expect(styles).toMatch(/\.touch-control\s*\{[^}]*min-height:\s*var\(--size-touch-min\);/s)
    expect(markup).not.toMatch(/\p{Extended_Pictographic}/u)
  })
})
