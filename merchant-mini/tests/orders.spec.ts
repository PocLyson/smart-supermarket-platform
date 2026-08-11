import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { createOrdersService } from '../miniprogram/services/orders'
import {
  ORDER_STATUS_TABS,
  availableOrderAction,
  buildOrderDetailUrl,
  canOwnerCancel,
  maskPhone,
  orderAction,
  orderStatusLabel,
  parseOrderListContext,
  paymentMethodLabel,
  paymentStatusLabel,
  readableOrderError,
  type MerchantOrder,
} from '../miniprogram/types/order'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.doUnmock('../miniprogram/services/orders')
})

const merchantOrder = (overrides: Partial<MerchantOrder> = {}): MerchantOrder => ({
  orderNo: 'ORD-1',
  totalCent: 590,
  status: 'PENDING_CONFIRMATION',
  paymentStatus: 'UNPAID',
  paymentMethod: null,
  pickupName: '张先生',
  phone: '13800138000',
  customerNote: null,
  cancelReason: null,
  createdAt: '2026-08-09T08:00:00Z',
  items: [],
  history: [],
  ...overrides,
})

const deferred = <T>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve
  })
  return { promise, resolve }
}

describe('merchant order presentation', () => {
  test('presents every supported status as a clear Chinese filter', () => {
    expect(ORDER_STATUS_TABS).toEqual([
      { value: '', label: '全部' },
      { value: 'PENDING_CONFIRMATION', label: '待接单' },
      { value: 'PREPARING', label: '备货中' },
      { value: 'READY_FOR_PICKUP', label: '待取货' },
      { value: 'COMPLETED', label: '已完成' },
      { value: 'CANCELLED', label: '已取消' },
    ])
    expect(orderStatusLabel.CANCELLED).toBe('已取消')
  })

  test('uses employee-readable payment labels', () => {
    expect(paymentStatusLabel).toEqual({ UNPAID: '未付款', PAID: '已付款' })
    expect(paymentMethodLabel).toEqual({
      CASH: '现金',
      WECHAT_QR: '微信收款码',
    })
  })

  test('masks the middle digits of a pickup phone number', () => {
    expect(maskPhone('13800138000')).toBe('138****8000')
    expect(maskPhone('')).toBe('未提供')
  })

  test('chooses the next primary action from the server state without inventing transitions', () => {
    expect(orderAction('PENDING_CONFIRMATION', 'CASHIER')).toBe('ACCEPT')
    expect(orderAction('PREPARING', 'OWNER')).toBe('MARK_READY')
    expect(orderAction('READY_FOR_PICKUP', 'CASHIER')).toBe('MARK_PAID')
    expect(orderAction('COMPLETED', 'OWNER')).toBeUndefined()
    expect(orderAction('CANCELLED', 'OWNER')).toBeUndefined()
  })

  test('keeps paid orders moving while hiding only the redundant payment action', () => {
    expect(availableOrderAction('PENDING_CONFIRMATION', 'CASHIER', 'PAID')).toBe('ACCEPT')
    expect(availableOrderAction('PREPARING', 'OWNER', 'PAID')).toBe('MARK_READY')
    expect(availableOrderAction('READY_FOR_PICKUP', 'CASHIER', 'PAID')).toBeUndefined()
  })

  test('never exposes cancellation to cashiers and limits owners to active orders', () => {
    expect(canOwnerCancel('PENDING_CONFIRMATION', 'CASHIER')).toBe(false)
    expect(canOwnerCancel('PREPARING', 'OWNER')).toBe(true)
    expect(canOwnerCancel('READY_FOR_PICKUP', 'OWNER')).toBe(true)
    expect(canOwnerCancel('COMPLETED', 'OWNER')).toBe(false)
  })

  test('round-trips list filters, page, and scroll position through detail navigation', () => {
    const url = buildOrderDetailUrl('ORD/2026 08', {
      status: 'PREPARING',
      paymentStatus: 'UNPAID',
      keyword: '138 0013',
      page: 2,
      scrollTop: 640,
    })
    expect(url).toBe(
      '/pages/order-detail/index?orderNo=ORD%2F2026%2008&status=PREPARING&paymentStatus=UNPAID&keyword=138%200013&page=2&scrollTop=640',
    )
    expect(parseOrderListContext(url.split('?')[1])).toEqual({
      status: 'PREPARING',
      paymentStatus: 'UNPAID',
      keyword: '138 0013',
      page: 2,
      scrollTop: 640,
    })
  })

  test('shows safe Chinese business errors verbatim and hides unsafe payloads', () => {
    expect(readableOrderError(new Error('当前状态不允许接单'))).toBe('当前状态不允许接单')
    expect(readableOrderError(new Error('<script>alert(1)</script>'))).toBe(
      '订单操作失败，请重试',
    )
  })
})

describe('merchant order API boundary', () => {
  test('sends list filters to the protected merchant list endpoint', async () => {
    const get = vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, size: 20 })
    const service = createOrdersService({ get, post: vi.fn() })

    await service.list({ status: 'PREPARING', paymentStatus: 'UNPAID', keyword: '138', page: 1, size: 20 })

    expect(get).toHaveBeenCalledWith('/api/merchant-mini/orders', {
      status: 'PREPARING',
      paymentStatus: 'UNPAID',
      keyword: '138',
      page: 1,
      size: 20,
    })
  })

  test('uses encoded order numbers and exact mutation payloads', async () => {
    const post = vi.fn().mockResolvedValue({ orderNo: 'ORD/1' })
    const service = createOrdersService({ get: vi.fn(), post })

    await service.accept('ORD/1')
    await service.markReady('ORD/1')
    await service.markPaid('ORD/1', 'WECHAT_QR')
    await service.cancel('ORD/1', '顾客要求取消')

    expect(post.mock.calls).toEqual([
      ['/api/merchant-mini/orders/ORD%2F1/accept'],
      ['/api/merchant-mini/orders/ORD%2F1/ready'],
      ['/api/merchant-mini/orders/ORD%2F1/pay', { method: 'WECHAT_QR' }],
      ['/api/merchant-mini/orders/ORD%2F1/cancel', { reason: '顾客要求取消' }],
    ])
  })

  test('restores every previously loaded page instead of collapsing to page zero', async () => {
    const get = vi.fn()
      .mockResolvedValueOnce({ items: [merchantOrder()], total: 3, page: 0, size: 2 })
      .mockResolvedValueOnce({
        items: [
          merchantOrder({ orderNo: 'ORD-2' }),
          merchantOrder({ orderNo: 'ORD-3' }),
        ],
        total: 3,
        page: 1,
        size: 2,
      })
    const service = createOrdersService({ get, post: vi.fn() })

    const restored = await service.listThrough({ status: 'PREPARING', size: 2 }, 1)

    expect(restored.items.map(({ orderNo }) => orderNo)).toEqual(['ORD-1', 'ORD-2', 'ORD-3'])
    expect(restored.page).toBe(1)
    expect(get.mock.calls).toEqual([
      ['/api/merchant-mini/orders', { status: 'PREPARING', size: 2, page: 0 }],
      ['/api/merchant-mini/orders', { status: 'PREPARING', size: 2, page: 1 }],
    ])
  })
})

describe('merchant order page interaction contracts', () => {
  test('locks before a deferred payment prompt so a double tap opens one prompt and submits once', async () => {
    vi.resetModules()
    const registerPage = vi.fn()
    const paymentResult = deferred<MerchantOrder>()
    const markPaid = vi.fn().mockReturnValue(paymentResult.promise)
    let actionSheet:
      | { success(result: { tapIndex: number }): void }
      | undefined
    const showActionSheet = vi.fn((options) => {
      actionSheet = options
    })
    vi.doMock('../miniprogram/services/orders', () => ({
      merchantOrdersService: {
        accept: vi.fn(),
        cancel: vi.fn(),
        detail: vi.fn(),
        markPaid,
        markReady: vi.fn(),
      },
    }))
    vi.stubGlobal('Page', registerPage)
    vi.stubGlobal('wx', {
      getStorageSync: vi.fn(),
      showActionSheet,
      showToast: vi.fn(),
    })
    await import('../miniprogram/pages/order-detail/index')
    const definition = registerPage.mock.calls[0][0] as Record<string, unknown> & {
      runPrimaryAction(): Promise<void>
    }
    const updated = merchantOrder({
      status: 'READY_FOR_PICKUP',
      paymentStatus: 'PAID',
      paymentMethod: 'CASH',
    })
    const context = {
      ...definition,
      data: {
        orderNo: 'ORD-1',
        role: 'CASHIER',
        order: merchantOrder({ status: 'READY_FOR_PICKUP' }),
        primaryAction: 'MARK_PAID',
        isMutating: false,
        errorMessage: '',
      },
      setData(values: Record<string, unknown>) {
        Object.assign(this.data, values)
      },
      applyOrder: vi.fn(),
      reload: vi.fn().mockResolvedValue(undefined),
      getOpenerEventChannel: () => ({ emit: vi.fn() }),
    }

    const firstTap = definition.runPrimaryAction.call(context)
    const secondTap = definition.runPrimaryAction.call(context)

    expect(showActionSheet).toHaveBeenCalledOnce()
    actionSheet?.success({ tapIndex: 0 })
    paymentResult.resolve(updated)
    await Promise.all([firstTap, secondTap])

    expect(markPaid).toHaveBeenCalledOnce()
    expect(context.applyOrder).toHaveBeenCalledWith(updated)
    expect(context.data.errorMessage).toBe('')
  })

  test('locks before a deferred cancel confirmation so a double tap cannot create a late mutation', async () => {
    vi.resetModules()
    const registerPage = vi.fn()
    const cancelResult = deferred<MerchantOrder>()
    const cancel = vi.fn().mockReturnValue(cancelResult.promise)
    let modal:
      | { success(result: { confirm: boolean; content?: string }): void }
      | undefined
    const showModal = vi.fn((options) => {
      modal = options
    })
    vi.doMock('../miniprogram/services/orders', () => ({
      merchantOrdersService: {
        accept: vi.fn(),
        cancel,
        detail: vi.fn(),
        markPaid: vi.fn(),
        markReady: vi.fn(),
      },
    }))
    vi.stubGlobal('Page', registerPage)
    vi.stubGlobal('wx', {
      getStorageSync: vi.fn(),
      showModal,
      showToast: vi.fn(),
    })
    await import('../miniprogram/pages/order-detail/index')
    const definition = registerPage.mock.calls[0][0] as Record<string, unknown> & {
      cancelOrder(): Promise<void>
    }
    const updated = merchantOrder({
      status: 'CANCELLED',
      cancelReason: '顾客要求取消',
    })
    const context = {
      ...definition,
      data: {
        orderNo: 'ORD-1',
        role: 'OWNER',
        order: merchantOrder(),
        isMutating: false,
        errorMessage: '',
      },
      setData(values: Record<string, unknown>) {
        Object.assign(this.data, values)
      },
      applyOrder: vi.fn(),
      reload: vi.fn().mockResolvedValue(undefined),
      getOpenerEventChannel: () => ({ emit: vi.fn() }),
    }

    const firstTap = definition.cancelOrder.call(context)
    const secondTap = definition.cancelOrder.call(context)

    expect(showModal).toHaveBeenCalledOnce()
    modal?.success({ confirm: true, content: '顾客要求取消' })
    cancelResult.resolve(updated)
    await Promise.all([firstTap, secondTap])

    expect(cancel).toHaveBeenCalledOnce()
    expect(context.applyOrder).toHaveBeenCalledWith(updated)
    expect(context.data.errorMessage).toBe('')
  })

  test('does not change a filter while the current list request is still running', async () => {
    vi.resetModules()
    const registerPage = vi.fn()
    vi.stubGlobal('Page', registerPage)
    await import('../miniprogram/pages/orders/index')
    const definition = registerPage.mock.calls[0][0] as {
      onStatusTap(event: { currentTarget: { dataset: { status: string } } }): void
    }
    const loadOrders = vi.fn()
    const context = {
      data: {
        selectedStatus: '',
        isLoading: true,
        isLoadingMore: false,
      },
      setData(values: Record<string, unknown>) {
        Object.assign(this.data, values)
      },
      loadOrders,
    }

    definition.onStatusTap.call(context, {
      currentTarget: { dataset: { status: 'PREPARING' } },
    })

    expect(context.data.selectedStatus).toBe('')
    expect(loadOrders).not.toHaveBeenCalled()
  })

  test('toggles the compact payment filter without changing the selected value', async () => {
    vi.resetModules()
    const registerPage = vi.fn()
    vi.stubGlobal('Page', registerPage)
    await import('../miniprogram/pages/orders/index')
    const definition = registerPage.mock.calls[0][0] as {
      togglePaymentFilter(): void
    }
    const context = {
      data: {
        isPaymentFilterOpen: false,
        selectedPaymentStatus: 'PAID',
        isLoading: false,
        isLoadingMore: false,
      },
      setData(values: Record<string, unknown>) {
        Object.assign(this.data, values)
      },
    }

    definition.togglePaymentFilter.call(context)
    expect(context.data.isPaymentFilterOpen).toBe(true)
    expect(context.data.selectedPaymentStatus).toBe('PAID')

    definition.togglePaymentFilter.call(context)
    expect(context.data.isPaymentFilterOpen).toBe(false)
    expect(context.data.selectedPaymentStatus).toBe('PAID')
  })

  test('keeps the order list usable when active-count summary loading fails', async () => {
    vi.resetModules()
    const registerPage = vi.fn()
    vi.doMock('../miniprogram/services/dashboard', () => ({
      merchantDashboardService: {
        summary: vi.fn().mockRejectedValue(new Error('summary unavailable')),
      },
    }))
    vi.stubGlobal('Page', registerPage)
    await import('../miniprogram/pages/orders/index')
    const definition = registerPage.mock.calls[0][0] as {
      loadActiveCounts(): Promise<void>
    }
    const context = {
      data: {
        isSummaryLoading: false,
        pendingCount: 2,
        preparingCount: 3,
        readyCount: 1,
      },
      setData(values: Record<string, unknown>) {
        Object.assign(this.data, values)
      },
    }

    await expect(definition.loadActiveCounts.call(context)).resolves.toBeUndefined()
    expect(context.data.isSummaryLoading).toBe(false)
    expect(context.data.pendingCount).toBe(2)
    expect(context.data.preparingCount).toBe(3)
    expect(context.data.readyCount).toBe(1)
  })

  test('preserves the loaded page range when returning from detail', async () => {
    vi.resetModules()
    const registerPage = vi.fn()
    vi.stubGlobal('Page', registerPage)
    vi.stubGlobal('wx', {
      getStorageSync: () => ({
        accessToken: 'token',
        role: 'CASHIER',
        staffId: 9,
        username: 'cashier',
        expiresAt: Date.now() + 60_000,
      }),
      reLaunch: vi.fn(),
    })
    await import('../miniprogram/pages/orders/index')
    const definition = registerPage.mock.calls[0][0] as { onShow(): void }
    const loadOrders = vi.fn()
    const refreshLoadedPages = vi.fn()
    const loadActiveCounts = vi.fn()

    definition.onShow.call({
      data: { hasLoaded: true },
      loadOrders,
      refreshLoadedPages,
      loadActiveCounts,
    })

    expect(refreshLoadedPages).toHaveBeenCalledOnce()
    expect(loadOrders).not.toHaveBeenCalled()
    expect(loadActiveCounts).toHaveBeenCalledOnce()
  })

  test('patches the opener list before reloading detail after a successful mutation', async () => {
    vi.resetModules()
    const registerPage = vi.fn()
    vi.stubGlobal('Page', registerPage)
    vi.stubGlobal('wx', { showToast: vi.fn() })
    await import('../miniprogram/pages/order-detail/index')
    const definition = registerPage.mock.calls[0][0] as {
      mutate(operation: () => Promise<MerchantOrder>, message: string): Promise<void>
    }
    const updated = merchantOrder({ status: 'PREPARING' })
    const emit = vi.fn()
    const applyOrder = vi.fn()
    const reload = vi.fn().mockResolvedValue(undefined)
    const context = {
      data: { isMutating: false },
      setData(values: Record<string, unknown>) {
        Object.assign(this.data, values)
      },
      applyOrder,
      reload,
      getOpenerEventChannel: () => ({ emit }),
    }

    await definition.mutate.call(context, async () => updated, '接单成功')

    expect(applyOrder).toHaveBeenCalledWith(updated)
    expect(emit).toHaveBeenCalledWith('orderUpdated', updated)
    expect(reload).toHaveBeenCalledWith(false, true)
  })

  test('keeps a successful mutation state when its follow-up detail refresh fails late', async () => {
    vi.resetModules()
    const registerPage = vi.fn()
    vi.doMock('../miniprogram/services/orders', () => ({
      merchantOrdersService: {
        detail: vi.fn().mockRejectedValue(new Error('late refresh failure')),
      },
    }))
    vi.stubGlobal('Page', registerPage)
    vi.stubGlobal('wx', { showToast: vi.fn() })
    await import('../miniprogram/pages/order-detail/index')
    const definition = registerPage.mock.calls[0][0] as {
      mutate(operation: () => Promise<MerchantOrder>, message: string): Promise<void>
      reload(showLoading: boolean, preserveCurrentOnError?: boolean): Promise<void>
    }
    const updated = merchantOrder({ status: 'PREPARING' })
    const applyOrder = vi.fn()
    const context = {
      data: { orderNo: 'ORD-1', isMutating: false, errorMessage: '' },
      setData(values: Record<string, unknown>) {
        Object.assign(this.data, values)
      },
      applyOrder,
      reload: definition.reload,
      getOpenerEventChannel: () => ({ emit: vi.fn() }),
    }

    await definition.mutate.call(context, async () => updated, '接单成功')

    expect(applyOrder).toHaveBeenCalledWith(updated)
    expect(context.data.errorMessage).toBe('')
    expect(context.data.isMutating).toBe(false)
  })

  test('retries the failed request mode instead of inferring it from stale rows', async () => {
    vi.resetModules()
    const registerPage = vi.fn()
    vi.stubGlobal('Page', registerPage)
    await import('../miniprogram/pages/orders/index')
    const definition = registerPage.mock.calls[0][0] as { retry(): void }
    const loadOrders = vi.fn()
    const refreshLoadedPages = vi.fn()

    definition.retry.call({
      data: { lastFailedRequest: 'RESET', orders: [merchantOrder()] },
      loadOrders,
      refreshLoadedPages,
    })
    expect(loadOrders).toHaveBeenCalledWith(true)

    loadOrders.mockClear()
    definition.retry.call({
      data: { lastFailedRequest: 'PRESERVE', orders: [merchantOrder()] },
      loadOrders,
      refreshLoadedPages,
    })
    expect(refreshLoadedPages).toHaveBeenCalledOnce()
    expect(loadOrders).not.toHaveBeenCalled()
  })

  test('includes recoverable list states and touch-safe controls', () => {
    const markup = readFileSync(resolve('miniprogram/pages/orders/index.wxml'), 'utf8')
    const styles = readFileSync(resolve('miniprogram/pages/orders/index.wxss'), 'utf8')

    expect(markup).toContain('bindtap="retry"')
    expect(markup).toContain('没有符合条件的订单')
    expect(markup).toContain('disabled="{{isLoadingMore}}"')
    expect(styles).toMatch(/\.status-tab\s*\{[^}]*min-height:\s*var\(--size-touch-min\);/s)
  })

  test('gates cancellation by role, confirms a reason, and displays it afterwards', () => {
    const markup = readFileSync(resolve('miniprogram/pages/order-detail/index.wxml'), 'utf8')
    const source = readFileSync(resolve('miniprogram/pages/order-detail/index.ts'), 'utf8')

    expect(markup).toContain('wx:if="{{role === \'OWNER\' && canCancel}}"')
    expect(markup).toContain('{{order.cancelReason}}')
    expect(source).toContain('editable: true')
    expect(source).toContain("placeholderText: '请输入取消原因'")
  })

  test('disables detail actions while a mutation is running', () => {
    const markup = readFileSync(resolve('miniprogram/pages/order-detail/index.wxml'), 'utf8')

    expect(markup).toContain('loading="{{isMutating}}"')
    expect(markup).toContain('disabled="{{isMutating}}"')
  })
})
