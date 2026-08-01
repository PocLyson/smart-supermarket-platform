import { ordersService } from '../../services/orders'
import { sessionStore } from '../../store/session'
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
  deletable: boolean
}

const presentOrder = (order: CustomerOrder): OrderCard => ({
  ...order,
  displayTotal: formatMoney(order.totalCent),
  displayCreatedAt: order.createdAt
    ? order.createdAt.replace('T', ' ').slice(0, 16)
    : '下单时间以订单详情为准',
  itemCount: order.items?.length || 0,
  imageUrl: resolveOrderProductImage(order.items?.[0]?.productId ?? 0),
  deletable: order.status === 'COMPLETED' || order.status === 'CANCELLED',
})

Page({
  data: {
    allOrders: [] as OrderCard[],
    orders: [] as OrderCard[],
    selectedStatus: 'ALL' as 'ALL' | OrderStatus,
    page: 0,
    loading: false,
    authRequired: false,
    empty: false,
    reachedEnd: false,
    error: '',
    deletingOrderNo: '',
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
    const loggedIn = Boolean(sessionStore.current())
    if (!loggedIn) {
      this.setData({
        authRequired: true,
        loading: false,
        error: '',
        allOrders: [],
        orders: [],
        empty: false,
        reachedEnd: false,
      })
      return
    }
    this.setData({ authRequired: false })
    void this.loadOrders(true)
  },

  onReachBottom() {
    if (!this.data.authRequired && !this.data.loading && !this.data.reachedEnd) {
      void this.loadOrders(false)
    }
  },

  async loadOrders(reset: boolean) {
    if (this.data.authRequired || this.data.loading) return
    const page = reset ? 0 : this.data.page
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

  onDeleteOrder(event: WechatMiniprogram.TouchEvent) {
    const orderNo = String(event.currentTarget.dataset.orderNo || '')
    if (!orderNo || this.data.deletingOrderNo) return
    wx.showModal({
      title: '删除订单',
      content: '删除后订单将从你的列表隐藏，但门店仍会依法保留交易记录。确定删除吗？',
      confirmText: '确认删除',
      confirmColor: '#B42318',
      success: ({ confirm }) => {
        if (confirm) void this.confirmDeleteOrder(orderNo)
      },
    })
  },

  async confirmDeleteOrder(orderNo: string) {
    this.setData({ deletingOrderNo: orderNo, error: '' })
    try {
      await ordersService.remove(orderNo)
      wx.showToast({ title: '订单已删除', icon: 'success' })
      await this.loadOrders(true)
    } catch (error) {
      this.setData({
        error: error instanceof Error ? error.message : '订单删除失败',
      })
    } finally {
      this.setData({ deletingOrderNo: '' })
    }
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

  onLogin() {
    wx.navigateTo({ url: '/pages/auth/index' })
  },

  onBackToProfile() {
    wx.navigateBack({
      fail: () => wx.reLaunch({ url: '/pages/profile/index' }),
    })
  },
})
