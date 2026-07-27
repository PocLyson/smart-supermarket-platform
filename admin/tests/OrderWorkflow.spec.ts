import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import OrderDetailView from '@/views/orders/OrderDetailView.vue'
import OrderListView from '@/views/orders/OrderListView.vue'
import * as ordersApi from '@/api/orders'
import { ApiError } from '@/api/http'

vi.mock('@/api/orders', () => ({
  listOrders: vi.fn(),
  getOrder: vi.fn(),
  acceptOrder: vi.fn(),
  rejectOrder: vi.fn(),
  markOrderReady: vi.fn(),
  markOrderPaid: vi.fn(),
  completeOrder: vi.fn(),
  cancelOrder: vi.fn(),
}))

const pendingOrder: ordersApi.AdminOrderDetail = {
  orderNo: '202607280001',
  customerId: 8,
  pickupName: '李先生',
  phone: '13800138000',
  totalCent: 1180,
  status: 'PENDING_CONFIRMATION',
  paymentStatus: 'UNPAID',
  paymentMethod: null,
  cancelReason: null,
  createdAt: '2026-07-28T08:00:00Z',
  updatedAt: '2026-07-28T08:00:00Z',
  items: [
    {
      productId: 1,
      productName: '纯牛奶',
      unit: '盒',
      unitPriceCent: 590,
      quantity: 2,
      subtotalCent: 1180,
    },
  ],
  statusHistory: [
    {
      fromStatus: null,
      toStatus: 'PENDING_CONFIRMATION',
      actorName: '顾客',
      remark: null,
      createdAt: '2026-07-28T08:00:00Z',
    },
  ],
}

describe('admin order workflow', () => {
  beforeEach(() => {
    vi.mocked(ordersApi.getOrder).mockResolvedValue(pendingOrder)
    vi.mocked(ordersApi.listOrders).mockResolvedValue({
      items: [pendingOrder],
      page: 0,
      size: 20,
      total: 1,
    })
  })

  it('shows only transitions valid for the current state and payment', async () => {
    const wrapper = mount(OrderDetailView, { props: { orderNo: pendingOrder.orderNo } })
    await flushPromises()

    expect(wrapper.find('[data-test="order-accept"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="order-reject"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="order-ready"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="order-complete"]').exists()).toBe(false)
  })

  it('requires a reason for rejection and refreshes after a successful mutation', async () => {
    vi.mocked(ordersApi.rejectOrder).mockResolvedValue(undefined)
    const wrapper = mount(OrderDetailView, { props: { orderNo: pendingOrder.orderNo } })
    await flushPromises()

    await wrapper.get('[data-test="order-reject"]').trigger('click')
    await wrapper.get('[data-test="order-mutation-submit"]').trigger('click')
    expect(wrapper.text()).toContain('请输入原因')
    expect(ordersApi.rejectOrder).not.toHaveBeenCalled()

    await wrapper.get('[data-test="order-mutation-reason"]').setValue('商品缺货')
    await wrapper.get('[data-test="order-mutation-submit"]').trigger('click')
    await flushPromises()

    expect(ordersApi.rejectOrder).toHaveBeenCalledWith(pendingOrder.orderNo, {
      reason: '商品缺货',
    })
    expect(ordersApi.getOrder).toHaveBeenCalledTimes(2)
  })

  it('keeps server state intact when a transition conflicts', async () => {
    vi.mocked(ordersApi.acceptOrder).mockRejectedValue(
      new ApiError('订单已被其他员工处理', 'ORDER_STATE_CONFLICT', 'req-2', 409),
    )
    const wrapper = mount(OrderDetailView, { props: { orderNo: pendingOrder.orderNo } })
    await flushPromises()

    await wrapper.get('[data-test="order-accept"]').trigger('click')
    await wrapper.get('[data-test="order-mutation-submit"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('订单已被其他员工处理')
    expect(wrapper.text()).toContain('待门店确认')
    expect(ordersApi.getOrder).toHaveBeenCalledTimes(1)
  })

  it('filters the order list by status, payment status, and keyword', async () => {
    const wrapper = mount(OrderListView)
    await flushPromises()

    await wrapper.get('[data-test="order-status-filter"]').setValue('PREPARING')
    await wrapper.get('[data-test="payment-status-filter"]').setValue('UNPAID')
    await wrapper.get('[data-test="order-keyword-filter"]').setValue('13800138000')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(ordersApi.listOrders).toHaveBeenLastCalledWith({
      status: 'PREPARING',
      paymentStatus: 'UNPAID',
      keyword: '13800138000',
      page: 0,
      size: 20,
    })
  })
})
