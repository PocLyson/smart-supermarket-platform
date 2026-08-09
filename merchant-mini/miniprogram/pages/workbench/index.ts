import { merchantDashboardService } from '../../services/dashboard'
import { merchantSessionStore, type MerchantSession } from '../../store/session'
import {
  dashboardOrderDestination,
  summarizeActiveOrders,
  type ActiveOrderMetric,
  type MerchantDashboardSummary,
} from '../../types/dashboard'
import {
  buildOrderDetailUrl,
  formatMoney,
  formatOrderTime,
  maskPhone,
  orderStatusLabel,
  paymentStatusLabel,
  type MerchantOrder,
} from '../../types/order'

interface WorkbenchOrder extends MerchantOrder {
  amountText: string
  createdAtText: string
  maskedPhone: string
  statusLabel: string
  paymentLabel: string
}

const presentOrder = (order: MerchantOrder): WorkbenchOrder => ({
  ...order,
  amountText: formatMoney(order.totalCent),
  createdAtText: formatOrderTime(order.createdAt),
  maskedPhone: maskPhone(order.phone),
  statusLabel: orderStatusLabel[order.status],
  paymentLabel: paymentStatusLabel[order.paymentStatus],
})

Page({
  data: {
    session: null as MerchantSession | null,
    summary: null as MerchantDashboardSummary | null,
    metrics: [] as ActiveOrderMetric[],
    latestOrders: [] as WorkbenchOrder[],
    isLoading: false,
    errorMessage: '',
  },

  onShow() {
    const session = merchantSessionStore.current()
    if (!session) {
      wx.reLaunch({ url: '/pages/login/index' })
      return
    }
    this.setData({ session })
    void this.loadSummary()
  },

  async loadSummary() {
    if (this.data.isLoading) return
    this.setData({ isLoading: true, errorMessage: '' })
    try {
      const summary = await merchantDashboardService.summary()
      this.setData({
        summary,
        metrics: summarizeActiveOrders(summary.orderCounts),
        latestOrders: summary.latestOrders.map(presentOrder),
      })
    } catch (error) {
      this.setData({
        errorMessage: error instanceof Error ? error.message : '工作台加载失败，请重试',
      })
    } finally {
      this.setData({ isLoading: false })
    }
  },

  retry() {
    void this.loadSummary()
  },

  onMetricTap(event: WechatMiniprogram.TouchEvent) {
    const status = event.currentTarget.dataset.status as ActiveOrderMetric['status']
    wx.redirectTo({ url: dashboardOrderDestination(status) })
  },

  onOrderTap(event: WechatMiniprogram.TouchEvent) {
    const orderNo = event.currentTarget.dataset.orderNo as string
    wx.navigateTo({
      url: buildOrderDetailUrl(orderNo, {
        status: '',
        paymentStatus: '',
        keyword: '',
        page: 0,
        scrollTop: 0,
      }),
    })
  },
})
