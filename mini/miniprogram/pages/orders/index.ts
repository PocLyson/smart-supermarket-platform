import { ordersService } from '../../services/orders'
import {
  orderStatusLabel,
  paymentStatusLabel,
  type CustomerOrder,
} from '../../types/order'

Page({
  data: {
    orders: [] as CustomerOrder[],
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
      const orders = reset
        ? result.items
        : [...this.data.orders, ...result.items]
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
})
