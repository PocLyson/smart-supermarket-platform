import { ordersService } from '../../services/orders'
import {
  orderStatusLabel,
  paymentStatusLabel,
  type CustomerOrder,
} from '../../types/order'
import { formatMoney } from '../../utils/money'

type OrderCard = CustomerOrder & {
  displayTotal: string
  displayCreatedAt: string
  itemCount: number
}

const presentOrder = (order: CustomerOrder): OrderCard => ({
  ...order,
  displayTotal: formatMoney(order.totalCent),
  displayCreatedAt: order.createdAt
    ? order.createdAt.replace('T', ' ').slice(0, 16)
    : '下单时间以订单详情为准',
  itemCount: order.items?.length || 0,
})

Page({
  data: {
    orders: [] as OrderCard[],
    page: 1,
    loading: false,
    empty: false,
    reachedEnd: false,
    error: '',
    orderStatusLabel,
    paymentStatusLabel,
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
      const orders = reset ? incoming : [...this.data.orders, ...incoming]
      this.setData({
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

  onGoShopping() {
    wx.reLaunch({ url: '/pages/home/index' })
  },
})
