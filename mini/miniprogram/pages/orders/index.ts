import { ordersService } from '../../services/orders'
import {
  orderStatusLabel,
  paymentStatusLabel,
  type CustomerOrder,
  type OrderStatus,
} from '../../types/order'
import { formatMoney } from '../../utils/money'
import { resolveOrderProductImage } from '../order-detail/presentation'

type OrderCard = CustomerOrder & {
  displayTotal: string
  displayCreatedAt: string
  itemCount: number
  imageUrl: string
}

const presentOrder = (order: CustomerOrder): OrderCard => ({
  ...order,
  displayTotal: formatMoney(order.totalCent),
  displayCreatedAt: order.createdAt
    ? order.createdAt.replace('T', ' ').slice(0, 16)
    : '下单时间以订单详情为准',
  itemCount: order.items?.length || 0,
  imageUrl: resolveOrderProductImage(order.items?.[0]?.productId ?? 0),
})

Page({
  data: {
    allOrders: [] as OrderCard[],
    orders: [] as OrderCard[],
    selectedStatus: 'ALL' as 'ALL' | OrderStatus,
    page: 1,
    loading: false,
    empty: false,
    reachedEnd: false,
    error: '',
    orderStatusLabel,
    paymentStatusLabel,
  },

  onLoad(query: Record<string, string | undefined>) {
    const status = query.status as OrderStatus | undefined
    if (
      status &&
      ['PENDING_CONFIRMATION', 'PREPARING', 'READY_FOR_PICKUP', 'COMPLETED'].includes(
        status,
      )
    ) {
      this.setData({ selectedStatus: status })
    }
  },

  onShow() {
    void this.loadOrders(true)
  },

  onReachBottom() {
    if (!this.data.loading && !this.data.reachedEnd) {
      void this.loadOrders(false)
    }
  },

  async loadOrders(reset: boolean) {
    if (this.data.loading) return
    const page = reset ? 1 : this.data.page
    this.setData({ loading: true, error: '' })
    try {
      const result = await ordersService.list({ page, size: 10 })
      const incoming = result.items.map(presentOrder)
      const allOrders = reset
        ? incoming
        : [...this.data.allOrders, ...incoming]
      const orders =
        this.data.selectedStatus === 'ALL'
          ? allOrders
          : allOrders.filter((order) => order.status === this.data.selectedStatus)
      this.setData({
        allOrders,
        orders,
        page: page + 1,
        empty: orders.length === 0,
        reachedEnd: orders.length >= result.total || result.items.length < 10,
      })
    } catch (error) {
      this.setData({
        error: error instanceof Error ? error.message : '订单加载失败',
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  onOpenOrder(event: WechatMiniprogram.TouchEvent) {
    const orderNo = String(event.currentTarget.dataset.orderNo)
    wx.navigateTo({
      url: `/pages/order-detail/index?orderNo=${encodeURIComponent(orderNo)}`,
    })
  },

  onFilterTap(event: WechatMiniprogram.TouchEvent) {
    const selectedStatus = String(event.currentTarget.dataset.status) as
      | 'ALL'
      | OrderStatus
    const orders =
      selectedStatus === 'ALL'
        ? this.data.allOrders
        : this.data.allOrders.filter((order) => order.status === selectedStatus)
    this.setData({
      selectedStatus,
      orders,
      empty: orders.length === 0,
    })
  },

  onGoShopping() {
    wx.reLaunch({ url: '/pages/home/index' })
  },
})
