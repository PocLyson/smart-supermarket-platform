import { profileService } from '../../services/auth'
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
    customerNote: '',
    customerNoteCount: 0,
    customerNoteError: '',
    items: presentItems(),
    totalCent: cart.selectedTotalCent(),
    displayTotal: formatMoney(cart.selectedTotalCent()),
    profileLoading: true,
    pickupReady: false,
    profileError: '',
    submitting: false,
    error: '',
    imageFailed: false,
    fallbackImage: '/assets/icons/image-placeholder.svg',
  },

  onLoad() {
    this.setData({
      customerNote: '',
      customerNoteCount: 0,
      customerNoteError: '',
    })
    checkout.updateCustomerNote('')
  },

  onShow() {
    this.setData({
      items: presentItems(),
      totalCent: cart.selectedTotalCent(),
      displayTotal: formatMoney(cart.selectedTotalCent()),
    })
    void this.loadProfile()
  },

  async loadProfile() {
    this.setData({ profileLoading: true, profileError: '' })
    try {
      const profile = await profileService.get()
      const fieldErrors = validateCheckoutFields(
        profile.pickupName,
        profile.phone,
      )
      this.setData({
        pickupName: profile.pickupName,
        phone: profile.phone,
        pickupReady:
          !fieldErrors.pickupNameError && !fieldErrors.phoneError,
      })
    } catch (error) {
      this.setData({
        pickupName: '',
        phone: '',
        pickupReady: false,
        profileError:
          error instanceof Error ? error.message : '取货信息加载失败',
      })
    } finally {
      this.setData({ profileLoading: false })
    }
  },

  async onSubmit() {
    if (this.data.submitting) return
    if (!this.data.pickupReady) {
      this.onEditPickup()
      return
    }
    const fieldErrors = validateCheckoutFields(
      this.data.pickupName,
      this.data.phone,
    )
    if (fieldErrors.pickupNameError || fieldErrors.phoneError) {
      this.setData({ pickupReady: false })
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

  onCustomerNoteInput(event: WechatMiniprogram.Input) {
    const customerNote = event.detail.value
    const customerNoteCount = customerNote.trim().length
    const customerNoteError =
      customerNoteCount > 100 ? '订单备注不能超过 100 个字符' : ''
    this.setData({ customerNote, customerNoteCount, customerNoteError })
    checkout.updateCustomerNote(customerNote)
  },

  onEditPickup() {
    wx.navigateTo({ url: '/pages/pickup-info/index' })
  },

  onRetryProfile() {
    void this.loadProfile()
  },
})
