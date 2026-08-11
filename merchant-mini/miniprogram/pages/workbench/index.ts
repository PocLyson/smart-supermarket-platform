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

interface WorkbenchMetric extends ActiveOrderMetric {
  icon: string
  tone: 'urgent' | 'preparing' | 'ready'
}

const metricPresentation: Record<WorkbenchMetric['status'], Pick<WorkbenchMetric, 'icon' | 'tone'>> = {
  PENDING_CONFIRMATION: {
    icon: '/assets/icons/orders.svg',
    tone: 'urgent',
  },
  PREPARING: {
    icon: '/assets/icons/workbench.svg',
    tone: 'preparing',
  },
  READY_FOR_PICKUP: {
    icon: '/assets/icons/verification.svg',
    tone: 'ready',
  },
}

const presentMetric = (metric: ActiveOrderMetric): WorkbenchMetric => ({
  ...metric,
  ...metricPresentation[metric.status],
})

const shortcutRoutes: Record<string, string> = {
  verification: '/pages/verify-pickup/index',
  products: '/pages/messages-unavailable/index?feature=products',
  announcements: '/pages/messages-unavailable/index?feature=announcements',
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
    roleLabel: '',
    summary: null as MerchantDashboardSummary | null,
    metrics: [] as WorkbenchMetric[],
    completedCount: 0,
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
    this.setData({
      session,
      roleLabel: session.role === 'OWNER' ? '老板' : '收银员',
    })
    void this.loadSummary()
  },

  async loadSummary() {
    if (this.data.isLoading) return
    this.setData({ isLoading: true, errorMessage: '' })
    try {
      const summary = await merchantDashboardService.summary()
      this.setData({
        summary,
        metrics: summarizeActiveOrders(summary.orderCounts).map(presentMetric),
        completedCount: summary.orderCounts.COMPLETED || 0,
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

  onAllOrdersTap() {
    wx.redirectTo({ url: '/pages/orders/index' })
  },

  onProfileTap() {
    wx.redirectTo({ url: '/pages/profile/index' })
  },

  onShortcutTap(event: WechatMiniprogram.TouchEvent) {
    const shortcut = event.currentTarget.dataset.shortcut as string
    const url = shortcutRoutes[shortcut]
    if (url) wx.navigateTo({ url })
  },
})
