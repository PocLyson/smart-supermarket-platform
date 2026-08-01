import { profileService } from '../../services/auth'
import { ordersService } from '../../services/orders'
import { sessionStore } from '../../store/session'
import type { OrderStatus } from '../../types/order'
import type { StoreContact } from '../../types/store'
import {
  callStorePhone,
  EMERGENCY_STORE_PHONE,
  loadStoreContact as loadMerchantContact,
} from '../../utils/merchant-contact'
import {
  buildActiveOrderCounts,
  buildProfileView,
} from './presentation'

const loggedOutView = buildProfileView(false)
const emptyOrderCounts = () => buildActiveOrderCounts([])

Page({
  data: {
    ...loggedOutView,
    orderCounts: emptyOrderCounts(),
    loading: false,
    error: '',
    storeContact: {
      phone: EMERGENCY_STORE_PHONE,
      customerServiceEnabled: false,
    } as StoreContact,
  },

  onShow() {
    if (sessionStore.current()) {
      void this.loadOrderCounts()
    } else {
      this.setData({ orderCounts: emptyOrderCounts() })
    }
    void this.loadProfile()
    void this.loadStoreContact()
  },

  async loadStoreContact() {
    this.setData({ storeContact: await loadMerchantContact() })
  },

  async loadOrderCounts() {
    try {
      const statuses: OrderStatus[] = []
      let page = 0
      let loaded = 0
      let total = 0
      do {
        const result = await ordersService.list({ page, size: 100 })
        statuses.push(...result.items.map((order) => order.status))
        loaded += result.items.length
        total = result.total
        page += 1
        if (result.items.length === 0) break
      } while (loaded < total)
      this.setData({ orderCounts: buildActiveOrderCounts(statuses) })
    } catch {
      this.setData({ orderCounts: emptyOrderCounts() })
    }
  },

  async loadProfile() {
    if (!sessionStore.current()) {
      this.setData({
        ...loggedOutView,
        orderCounts: emptyOrderCounts(),
        loading: false,
        error: '',
      })
      return
    }
    this.setData({ loading: true, error: '' })
    try {
      const profile = await profileService.get()
      this.setData({
        ...buildProfileView(true, profile),
      })
    } catch (error) {
      this.setData({
        error: error instanceof Error ? error.message : '资料加载失败',
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  onLogin() {
    wx.navigateTo({ url: '/pages/auth/index?from=profile' })
  },

  onOrders() {
    wx.navigateTo({ url: '/pages/orders/index' })
  },

  onOrderStatus(event: WechatMiniprogram.TouchEvent) {
    const status = String(event.currentTarget.dataset.status || '')
    wx.navigateTo({
      url: `/pages/orders/index${status ? `?status=${status}` : ''}`,
    })
  },

  onSettings() {
    wx.navigateTo({ url: '/pages/settings/index' })
  },

  onCallStore() {
    void callStorePhone(this.data.storeContact.phone)
  },

  onRetry() {
    void this.loadProfile()
  },
})
