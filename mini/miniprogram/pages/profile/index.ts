import { profileService } from '../../services/auth'
import { sessionStore } from '../../store/session'
import { buildProfileView, validateProfile } from './presentation'

const loggedOutView = buildProfileView(false)

Page({
  data: {
    ...loggedOutView,
    pickupName: '',
    phone: '',
    loading: false,
    saving: false,
    error: '',
    pickupNameError: '',
    phoneError: '',
  },

  onShow() {
    void this.loadProfile()
  },

  async loadProfile() {
    if (!sessionStore.current()) {
      this.setData({
        ...loggedOutView,
        pickupName: '',
        phone: '',
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
        pickupName: profile.pickupName || '',
        phone: profile.phone || '',
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

  onPickupNameInput(event: WechatMiniprogram.Input) {
    this.setData({ pickupName: event.detail.value, pickupNameError: '' })
  },

  onPhoneInput(event: WechatMiniprogram.Input) {
    this.setData({ phone: event.detail.value, phoneError: '' })
  },

  async onSave() {
    const error = validateProfile(this.data.pickupName, this.data.phone)
    if (error) {
      this.setData({
        pickupNameError: !this.data.pickupName.trim()
          ? '请输入取货人姓名'
          : '',
        phoneError: /^1\d{10}$/.test(this.data.phone)
          ? ''
          : '请输入正确的11位手机号',
      })
      return
    }
    this.setData({ saving: true, error: '' })
    try {
      const profile = await profileService.save({
        pickupName: this.data.pickupName.trim(),
        phone: this.data.phone,
      })
      const current = sessionStore.current()
      if (current) sessionStore.save({ ...current, profileComplete: true })
      this.setData({ ...buildProfileView(true, profile) })
      wx.showToast({ title: '取货信息已保存', icon: 'success' })
    } catch (saveError) {
      this.setData({
        error: saveError instanceof Error ? saveError.message : '保存失败',
      })
    } finally {
      this.setData({ saving: false })
    }
  },

  onOrders() {
    wx.redirectTo({ url: '/pages/orders/index' })
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

  onRetry() {
    void this.loadProfile()
  },
})
