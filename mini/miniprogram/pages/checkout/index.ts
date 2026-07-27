import { checkout } from '../../store/checkout'
import { cart } from '../../store/cart'

Page({
  data: {
    pickupName: '',
    phone: '',
    items: cart.selectedItems(),
    totalCent: cart.selectedTotalCent(),
    submitting: false,
    error: '',
  },

  onShow() {
    this.setData({
      items: cart.selectedItems(),
      totalCent: cart.selectedTotalCent(),
    })
  },

  onPickupNameInput(event: WechatMiniprogram.Input) {
    this.setData({ pickupName: event.detail.value })
  },

  onPhoneInput(event: WechatMiniprogram.Input) {
    this.setData({ phone: event.detail.value })
  },

  async onSubmit() {
    if (this.data.submitting) return
    checkout.updateContact({
      pickupName: this.data.pickupName,
      phone: this.data.phone,
    })
    this.setData({ submitting: true, error: '' })
    try {
      const order = await checkout.submit()
      wx.redirectTo({
        url: `/pages/order-detail/index?orderNo=${encodeURIComponent(order.orderNo)}`,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : '提交订单失败'
      this.setData({ error: message })
      wx.showToast({ title: message, icon: 'none' })
    } finally {
      this.setData({ submitting: false })
    }
  },
})
