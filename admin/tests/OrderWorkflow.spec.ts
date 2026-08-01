import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import OrderDetailView from '@/views/orders/OrderDetailView.vue'
import OrderListView from '@/views/orders/OrderListView.vue'
import * as ordersApi from '@/api/orders'
import { ApiError } from '@/api/http'
import { ElMessageBox } from 'element-plus'

const RouterLinkProbe = defineComponent({
  name: 'RouterLinkProbe',
  props: {
    to: {
      type: [String, Object],
      required: true,
    },
  },
  template: '<a><slot /></a>',
})

vi.mock('@/api/orders', () => ({
  listOrders: vi.fn(),
  getOrder: vi.fn(),
  acceptOrder: vi.fn(),
  rejectOrder: vi.fn(),
  markOrderReady: vi.fn(),
  markOrderPaid: vi.fn(),
  completeOrder: vi.fn(),
  cancelOrder: vi.fn(),
  archiveOrder: vi.fn(),
  restoreOrder: vi.fn(),
}))

const pendingOrder: ordersApi.AdminOrderDetail = {
  orderNo: '202607280001',
  pickupName: '李先生',
  phone: '13800138000',
  totalCent: 1180,
  status: 'PENDING_CONFIRMATION',
  paymentStatus: 'UNPAID',
  paymentMethod: null,
  customerNote: null,
  cancelReason: null,
  createdAt: '2026-07-28T08:00:00Z',
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
  history: [
    {
      fromStatus: null,
      toStatus: 'PENDING_CONFIRMATION',
      actorType: 'CUSTOMER',
      actorId: 8,
      remark: null,
      createdAt: '2026-07-28T08:00:00Z',
    },
  ],
}

const readyPaidOrder: ordersApi.AdminOrderDetail = {
  ...pendingOrder,
  status: 'READY_FOR_PICKUP',
  paymentStatus: 'PAID',
  paymentMethod: 'CASH',
}

const completedOrder: ordersApi.AdminOrderDetail = {
  ...readyPaidOrder,
  status: 'COMPLETED',
}

const cancelledOrder: ordersApi.AdminOrderDetail = {
  ...pendingOrder,
  status: 'CANCELLED',
  cancelReason: '商品缺货',
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
    expect(wrapper.text()).not.toContain('280 001')
    expect(wrapper.get('[data-test="pickup-verification-help"]').text()).toContain(
      '顾客小程序中的6位取货码',
    )
    expect(wrapper.find('[data-test="order-reject"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="order-ready"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="order-complete"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('顾客')
  })

  it('renders a customer note in order detail', async () => {
    vi.mocked(ordersApi.getOrder).mockResolvedValue({
      ...pendingOrder,
      customerNote: '饮料要常温',
    })
    const wrapper = mount(OrderDetailView, { props: { orderNo: pendingOrder.orderNo } })
    await flushPromises()

    expect(wrapper.text()).toContain('顾客备注')
    expect(wrapper.text()).toContain('饮料要常温')
  })

  it('requires a reason for rejection and applies the successful mutation response', async () => {
    vi.mocked(ordersApi.rejectOrder).mockResolvedValue(cancelledOrder)
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
    expect(ordersApi.getOrder).toHaveBeenCalledTimes(1)
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

  it('requires a six-digit pickup code before completing an order', async () => {
    vi.mocked(ordersApi.getOrder).mockResolvedValue(readyPaidOrder)
    vi.mocked(ordersApi.completeOrder).mockResolvedValue(completedOrder)
    const wrapper = mount(OrderDetailView, { props: { orderNo: readyPaidOrder.orderNo } })
    await flushPromises()

    await wrapper.get('[data-test="order-complete"]').trigger('click')
    await wrapper.get('[data-test="order-mutation-submit"]').trigger('click')
    expect(wrapper.text()).toContain('请输入6位取货码')
    expect(ordersApi.completeOrder).not.toHaveBeenCalled()

    await wrapper.get('[data-test="pickup-code-input"]').setValue('280001')
    await wrapper.get('[data-test="order-mutation-submit"]').trigger('click')
    await flushPromises()

    expect(ordersApi.completeOrder).toHaveBeenCalledWith(readyPaidOrder.orderNo, {
      pickupCode: '280001',
    })
    expect(wrapper.find('[data-test="order-complete"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('已完成')
  })

  it('keeps the completion dialog open when the pickup code is incorrect', async () => {
    vi.mocked(ordersApi.getOrder).mockResolvedValue(readyPaidOrder)
    vi.mocked(ordersApi.completeOrder).mockRejectedValue(
      new ApiError(
        '取货码不正确，请与顾客核对后重试',
        'PICKUP_CODE_MISMATCH',
        'req-code',
        409,
      ),
    )
    const wrapper = mount(OrderDetailView, { props: { orderNo: readyPaidOrder.orderNo } })
    await flushPromises()

    await wrapper.get('[data-test="order-complete"]').trigger('click')
    await wrapper.get('[data-test="pickup-code-input"]').setValue('000000')
    await wrapper.get('[data-test="order-mutation-submit"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('取货码不正确，请与顾客核对后重试')
    expect(
      (wrapper.get('[data-test="pickup-code-input"]').element as HTMLInputElement).value,
    ).toBe('000000')
    expect(wrapper.text()).toContain('待取货')
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
      archived: false,
      page: 0,
      size: 20,
    })
  })

  it('renders order cards on narrow screens and the formal pickup store on detail', async () => {
    const list = mount(OrderListView)
    await flushPromises()
    expect(list.find('[data-test="order-mobile-list"]').exists()).toBe(true)

    const detail = mount(OrderDetailView, { props: { orderNo: pendingOrder.orderNo } })
    await flushPromises()
    expect(detail.text()).toContain('鲁能超市李老家分店')
  })

  it('archives a completed order after confirmation and refreshes the list', async () => {
    vi.mocked(ordersApi.listOrders).mockResolvedValue({
      items: [completedOrder],
      page: 0,
      size: 20,
      total: 1,
    })
    vi.mocked(ordersApi.archiveOrder).mockResolvedValue({ deleted: true })
    vi.spyOn(ElMessageBox, 'confirm').mockResolvedValue('confirm' as never)
    const wrapper = mount(OrderListView)
    await flushPromises()

    await wrapper.get(`[data-test="archive-${completedOrder.orderNo}"]`).trigger('click')
    await flushPromises()

    expect(ordersApi.archiveOrder).toHaveBeenCalledWith(completedOrder.orderNo)
    expect(ordersApi.listOrders).toHaveBeenCalledTimes(2)
  })

  it('keeps a terminal order when archive confirmation is cancelled', async () => {
    vi.mocked(ordersApi.listOrders).mockResolvedValue({
      items: [completedOrder],
      page: 0,
      size: 20,
      total: 1,
    })
    vi.spyOn(ElMessageBox, 'confirm').mockRejectedValue('cancel')
    const wrapper = mount(OrderListView)
    await flushPromises()

    await wrapper.get(`[data-test="archive-${completedOrder.orderNo}"]`).trigger('click')
    await flushPromises()

    expect(ordersApi.archiveOrder).not.toHaveBeenCalled()
  })

  it('loads archived orders and restores one to the active list', async () => {
    vi.mocked(ordersApi.listOrders).mockResolvedValue({
      items: [completedOrder],
      page: 0,
      size: 20,
      total: 1,
    })
    vi.mocked(ordersApi.restoreOrder).mockResolvedValue(completedOrder)
    const wrapper = mount(OrderListView)
    await flushPromises()

    await wrapper.get('[data-test="archived-orders-tab"]').trigger('click')
    await flushPromises()

    expect(ordersApi.listOrders).toHaveBeenLastCalledWith({
      status: undefined,
      paymentStatus: undefined,
      keyword: undefined,
      archived: true,
      page: 0,
      size: 20,
    })

    await wrapper
      .get(`[data-test="restore-${completedOrder.orderNo}"]`)
      .trigger('click')
    await flushPromises()

    expect(ordersApi.restoreOrder).toHaveBeenCalledWith(completedOrder.orderNo)
    expect(ordersApi.listOrders).toHaveBeenCalledTimes(3)
  })

  it.each([
    {
      label: '已完成',
      initialQuery: { status: 'COMPLETED', page: '2' },
      expectedListQuery: {
        status: 'COMPLETED',
        paymentStatus: undefined,
        keyword: undefined,
        archived: false,
        page: 1,
        size: 20,
      },
      expectedRouteQuery: { status: 'COMPLETED', page: '2' },
    },
    {
      label: '已归档',
      initialQuery: { archived: 'true' },
      expectedListQuery: {
        status: undefined,
        paymentStatus: undefined,
        keyword: undefined,
        archived: true,
        page: 0,
        size: 20,
      },
      expectedRouteQuery: { archived: 'true' },
    },
    {
      label: '全部',
      initialQuery: {},
      expectedListQuery: {
        status: undefined,
        paymentStatus: undefined,
        keyword: undefined,
        archived: false,
        page: 0,
        size: 20,
      },
      expectedRouteQuery: {},
    },
  ])('returns from detail to the $label order list context', async ({
    initialQuery,
    expectedListQuery,
    expectedRouteQuery,
  }) => {
    vi.mocked(ordersApi.listOrders).mockResolvedValue({
      items: [completedOrder],
      page: expectedListQuery.page,
      size: 20,
      total: 21,
    })
    const list = mount(OrderListView, {
      props: { initialQuery } as never,
      global: { stubs: { RouterLink: RouterLinkProbe } },
    })
    await flushPromises()

    expect(ordersApi.listOrders).toHaveBeenLastCalledWith(expectedListQuery)
    const detailTarget = list.findComponent(RouterLinkProbe).props('to')
    expect(detailTarget).toEqual({
      path: `/orders/${completedOrder.orderNo}`,
      query: expectedRouteQuery,
    })

    const detail = mount(OrderDetailView, {
      props: {
        orderNo: completedOrder.orderNo,
        returnQuery: expectedRouteQuery,
      } as never,
      global: { stubs: { RouterLink: RouterLinkProbe } },
    })
    await flushPromises()

    expect(detail.findComponent(RouterLinkProbe).props('to')).toEqual({
      name: 'orders',
      query: expectedRouteQuery,
    })
  })

  it('syncs the selected list context into browser history before opening details', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: '/orders',
          name: 'orders',
          component: { template: '<div />' },
        },
      ],
    })
    await router.push('/orders')
    await router.isReady()
    const wrapper = mount(OrderListView, {
      global: {
        plugins: [router],
      },
    })
    await flushPromises()

    const completedTab = wrapper
      .findAll('.status-tabs button')
      .find((button) => button.text() === '已完成')
    expect(completedTab).toBeDefined()
    await completedTab!.trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.query).toEqual({
      status: 'COMPLETED',
    })
  })
})
