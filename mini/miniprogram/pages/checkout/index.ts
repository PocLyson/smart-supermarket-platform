import { checkout } from '../../store/checkout'
import { cart } from '../../store/cart'
import { validateCheckoutFields } from './presentation'
import { formatMoney } from '../../utils/money'

const presentItems = () =>
  cart.selectedItems().map((item) => ({
    ...item,
    displaySubtotal: formatMoney(item.unitPriceCent * item.quantity),
  }))

Page({
  data: {
    pickupName: '',
    phone: '',
    items: presentItems(),
    totalCent: cart.selectedTotalCent(),
    displayTotal: formatMoney(cart.selectedTotalCent()),
    submitting: false,
    error: '',
    pickupNameError: '',
    phoneError: '',
    imageFailed: false,
    fallbackImage: '/assets/icons/image-placeholder.svg',
  },

  onShow() {
    this.setData({
      items: presentItems(),
      totalCent: cart.selectedTotalCent(),
      displayTotal: formatMoney(cart.selectedTotalCent()),
    })
  },

  onPickupNameInput(event: WechatMiniprogram.Input) {
    this.setData({ pickupName: event.detail.value, pickupNameError: '' })
  },

  onPhoneInput(event: WechatMiniprogram.Input) {
    this.setData({ phone: event.detail.value, phoneError: '' })
  },

  async onSubmit() {
    if (this.data.submitting) return
    const fieldErrors = validateCheckoutFields(
      this.data.pickupName,
      this.data.phone,
    )
    if (fieldErrors.pickupNameError || fieldErrors.phoneError) {
      this.setData(fieldErrors)
      return
    }
    checkout.updateContact({
      pickupName: this.data.pickupName,
      phone: this.data.phone,
    })
    this.setData({ submitting: true, error: '' })
    try {
      const order = await checkout.submit()
      wx.redirectTo({
        url: `/pages/submit-result/index?orderNo=${encodeURIComponent(order.orderNo)}`,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : '提交订单失败'
      if (message.includes('尚未确认')) {
        wx.redirectTo({ url: '/pages/submit-result/index?uncertain=1' })
        return
      }
      this.setData({ error: message })
      wx.showToast({ title: message, icon: 'none' })
    } finally {
      this.setData({ submitting: false })
    }
  },

  onImageError() {
    this.setData({ imageFailed: true })
  },
})
