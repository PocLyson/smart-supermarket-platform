import { ordersService } from '../../services/orders'
import type { StoreContact } from '../../types/store'
import {
  callStorePhone,
  EMERGENCY_STORE_PHONE,
  loadStoreContact as loadMerchantContact,
} from '../../utils/merchant-contact'
import {
  canCustomerCancel,
  orderStatusLabel,
  paymentStatusLabel,
  type CustomerOrder,
} from '../../types/order'
import { formatMoney } from '../../utils/money'
import {
  buildOrderStatusPresentation,
  formatPickupCode,
  presentOrderHistory,
  resolveOrderProductImage,
  type PresentedOrderHistory,
  type OrderStatusPresentation,
} from './presentation'

Page({
  data: {
    orderNo: '',
    order: undefined as CustomerOrder | undefined,
    loading: true,
    cancelling: false,
    canCancel: false,
    error: '',
    displayTotal: '',
    pickupCode: '',
    displayItems: [] as Array<
      CustomerOrder['items'][number] & {
        displaySubtotal: string
        imageUrl: string
      }
    >,
    displayHistory: [] as PresentedOrderHistory[],
    statusPresentation: {
      title: '',
      description: '',
    } as OrderStatusPresentation,
    orderStatusLabel,
    paymentStatusLabel,
    storeContact: {
      phone: EMERGENCY_STORE_PHONE,
      customerServiceEnabled: false,
    } as StoreContact,
  },

  onLoad(query: Record<string, string | undefined>) {
    const orderNo = query.orderNo ? decodeURIComponent(query.orderNo) : ''
    if (!orderNo) {
      this.setData({ loading: false, error: '订单参数无效' })
      return
    }
    this.setData({ orderNo })
    void this.loadOrder()
    void this.loadStoreContact()
  },

  async loadStoreContact() {
    this.setData({ storeContact: await loadMerchantContact() })
  },

  async loadOrder() {
    this.setData({ loading: true, error: '' })
    try {
      const order = await ordersService.detail(this.data.orderNo)
      this.setData({
        order,
        canCancel: canCustomerCancel(order.status),
        displayTotal: formatMoney(order.totalCent),
        displayItems: order.items.map((item) => ({
          ...item,
          displaySubtotal: formatMoney(item.subtotalCent),
          imageUrl: resolveOrderProductImage(item.productId),
        })),
        statusPresentation: buildOrderStatusPresentation(order.status),
        displayHistory: presentOrderHistory(order.history),
        pickupCode: formatPickupCode(order.pickupCode),
      })
    } catch (error) {
      this.setData({
        error: error instanceof Error ? error.message : '订单加载失败',
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  onCancel() {
    if (!this.data.canCancel || this.data.cancelling) return
    wx.showModal({
      title: '取消订单',
      content: `确认取消订单 ${this.data.orderNo}？`,
      success: ({ confirm }) => {
        if (confirm) void this.confirmCancel()
      },
    })
  },

  async confirmCancel() {
    this.setData({ cancelling: true, error: '' })
    try {
      const order = await ordersService.cancel(this.data.orderNo)
      this.setData({
        order,
        canCancel: false,
        statusPresentation: buildOrderStatusPresentation(order.status),
        displayHistory: presentOrderHistory(order.history),
      })
      wx.showToast({ title: '订单已取消', icon: 'success' })
    } catch (error) {
      this.setData({
        error: error instanceof Error ? error.message : '取消订单失败',
      })
    } finally {
      this.setData({ cancelling: false })
    }
  },

  onCallStore() {
    void callStorePhone(this.data.storeContact.phone)
  },
})
