import { merchantOrdersService } from '../../services/orders'
import { merchantSessionStore } from '../../store/session'
import {
  ORDER_STATUS_TABS,
  buildOrderDetailUrl,
  formatMoney,
  formatOrderTime,
  maskPhone,
  orderStatusLabel,
  paymentStatusLabel,
  readableOrderError,
  type MerchantOrder,
  type OrderListContext,
  type OrderStatus,
  type PaymentStatus,
} from '../../types/order'

interface PresentedOrder extends MerchantOrder {
  amountText: string
  createdAtText: string
  maskedPhone: string
  statusLabel: string
  paymentLabel: string
}

const presentOrder = (order: MerchantOrder): PresentedOrder => ({
  ...order,
  amountText: formatMoney(order.totalCent),
  createdAtText: formatOrderTime(order.createdAt),
  maskedPhone: maskPhone(order.phone),
  statusLabel: orderStatusLabel[order.status],
  paymentLabel: paymentStatusLabel[order.paymentStatus],
})

const optionStatus = (value: string | undefined): OrderStatus | '' =>
  ORDER_STATUS_TABS.some((tab) => tab.value === value) ? value as OrderStatus | '' : ''

Page({
  data: {
    statusTabs: ORDER_STATUS_TABS,
    paymentTabs: [
      { value: '', label: '全部付款' },
      { value: 'UNPAID', label: '未付款' },
      { value: 'PAID', label: '已付款' },
    ],
    selectedStatus: '' as OrderStatus | '',
    selectedPaymentStatus: '' as PaymentStatus | '',
    keyword: '',
    draftKeyword: '',
    orders: [] as PresentedOrder[],
    page: 0,
    size: 20,
    total: 0,
    hasMore: false,
    scrollTop: 0,
    hasLoaded: false,
    lastFailedRequest: '' as '' | 'RESET' | 'MORE' | 'PRESERVE',
    isLoading: false,
    isLoadingMore: false,
    errorMessage: '',
  },

  onLoad(options: Record<string, string | undefined>) {
    this.setData({ selectedStatus: optionStatus(options.status) })
  },

  onShow() {
    if (!merchantSessionStore.current()) {
      wx.reLaunch({ url: '/pages/login/index' })
      return
    }
    if (this.data.hasLoaded) {
      void this.refreshLoadedPages()
    } else {
      void this.loadOrders(true)
    }
  },

  onPageScroll(event: { scrollTop: number }) {
    this.setData({ scrollTop: event.scrollTop })
  },

  async loadOrders(reset: boolean) {
    if (this.data.isLoading || this.data.isLoadingMore) return
    const page = reset ? 0 : this.data.page + 1
    this.setData({
      [reset ? 'isLoading' : 'isLoadingMore']: true,
      errorMessage: '',
      lastFailedRequest: '',
      ...(reset ? {
        orders: [],
        page: 0,
        total: 0,
        hasMore: false,
      } : {}),
    })
    try {
      const result = await merchantOrdersService.list({
        status: this.data.selectedStatus || undefined,
        paymentStatus: this.data.selectedPaymentStatus || undefined,
        keyword: this.data.keyword || undefined,
        page,
        size: this.data.size,
      })
      const orders = reset
        ? result.items.map(presentOrder)
        : [...this.data.orders, ...result.items.map(presentOrder)]
      this.setData({
        orders,
        page: result.page,
        total: result.total,
        hasMore: orders.length < result.total,
        hasLoaded: true,
        lastFailedRequest: '',
      })
      if (reset && this.data.scrollTop > 0) {
        wx.pageScrollTo({ scrollTop: this.data.scrollTop, duration: 0 })
      }
    } catch (error) {
      this.setData({
        errorMessage: readableOrderError(error),
        lastFailedRequest: reset ? 'RESET' : 'MORE',
      })
    } finally {
      this.setData({ isLoading: false, isLoadingMore: false })
    }
  },

  async refreshLoadedPages() {
    if (this.data.isLoading || this.data.isLoadingMore) return
    const { page, scrollTop } = this.data
    this.setData({ isLoading: true, errorMessage: '', lastFailedRequest: '' })
    try {
      const result = await merchantOrdersService.listThrough({
        status: this.data.selectedStatus || undefined,
        paymentStatus: this.data.selectedPaymentStatus || undefined,
        keyword: this.data.keyword || undefined,
        size: this.data.size,
      }, page)
      const orders = result.items.map(presentOrder)
      this.setData({
        orders,
        page,
        total: result.total,
        hasMore: orders.length < result.total,
        hasLoaded: true,
        lastFailedRequest: '',
      }, () => {
        if (scrollTop > 0) wx.pageScrollTo({ scrollTop, duration: 0 })
      })
    } catch (error) {
      this.setData({
        errorMessage: readableOrderError(error),
        lastFailedRequest: 'PRESERVE',
      })
    } finally {
      this.setData({ isLoading: false })
    }
  },

  retry() {
    if (this.data.lastFailedRequest === 'PRESERVE') {
      void this.refreshLoadedPages()
      return
    }
    void this.loadOrders(this.data.lastFailedRequest !== 'MORE')
  },

  onStatusTap(event: WechatMiniprogram.TouchEvent) {
    if (this.data.isLoading || this.data.isLoadingMore) return
    const status = optionStatus(event.currentTarget.dataset.status as string)
    if (status === this.data.selectedStatus) return
    this.setData({ selectedStatus: status, scrollTop: 0 })
    void this.loadOrders(true)
  },

  onPaymentTap(event: WechatMiniprogram.TouchEvent) {
    if (this.data.isLoading || this.data.isLoadingMore) return
    const value = event.currentTarget.dataset.status as PaymentStatus | ''
    if (value === this.data.selectedPaymentStatus) return
    this.setData({ selectedPaymentStatus: value, scrollTop: 0 })
    void this.loadOrders(true)
  },

  onKeywordInput(event: WechatMiniprogram.Input) {
    this.setData({ draftKeyword: event.detail.value })
  },

  search() {
    if (this.data.isLoading || this.data.isLoadingMore) return
    const keyword = this.data.draftKeyword.trim()
    this.setData({ keyword, scrollTop: 0 })
    void this.loadOrders(true)
  },

  loadMore() {
    if (!this.data.hasMore || this.data.isLoadingMore) return
    void this.loadOrders(false)
  },

  patchOrder(order: MerchantOrder) {
    const index = this.data.orders.findIndex(({ orderNo }) => orderNo === order.orderNo)
    if (index < 0) return
    const matchesStatus = !this.data.selectedStatus || order.status === this.data.selectedStatus
    const matchesPayment = !this.data.selectedPaymentStatus
      || order.paymentStatus === this.data.selectedPaymentStatus
    const orders = [...this.data.orders]
    let total = this.data.total
    if (matchesStatus && matchesPayment) {
      orders[index] = presentOrder(order)
    } else {
      orders.splice(index, 1)
      total = Math.max(0, total - 1)
    }
    this.setData({ orders, total, hasMore: orders.length < total })
  },

  onOrderTap(event: WechatMiniprogram.TouchEvent) {
    const context: OrderListContext = {
      status: this.data.selectedStatus,
      paymentStatus: this.data.selectedPaymentStatus,
      keyword: this.data.keyword,
      page: this.data.page,
      scrollTop: this.data.scrollTop,
    }
    wx.navigateTo({
      url: buildOrderDetailUrl(event.currentTarget.dataset.orderNo as string, context),
      success: ({ eventChannel }) => {
        eventChannel.on('orderUpdated', (order: MerchantOrder) => this.patchOrder(order))
      },
    })
  },
})
