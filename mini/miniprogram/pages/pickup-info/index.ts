import { profileService } from '../../services/auth'
import { sessionStore } from '../../store/session'
import { validateProfile } from '../profile/presentation'

Page({
  data: {
    pickupName: '',
    phone: '',
    loading: true,
    saving: false,
    error: '',
    pickupNameError: '',
    phoneError: '',
  },

  onShow() {
    if (!sessionStore.current()) {
      wx.redirectTo({ url: '/pages/auth/index' })
      return
    }
    void this.loadProfile()
  },

  async loadProfile() {
    this.setData({ loading: true, error: '' })
    try {
      const profile = await profileService.get()
      this.setData({
        pickupName: profile.pickupName || '',
        phone: profile.phone || '',
      })
    } catch (error) {
      this.setData({
        error: error instanceof Error ? error.message : '取货信息加载失败',
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  onPickupNameInput(event: WechatMiniprogram.Input) {
    this.setData({ pickupName: event.detail.value, pickupNameError: '' })
  },

  onPhoneInput(event: WechatMiniprogram.Input) {
    this.setData({ phone: event.detail.value, phoneError: '' })
  },

  async onSave() {
    if (this.data.saving) return
    const validationError = validateProfile(
      this.data.pickupName,
      this.data.phone,
    )
    if (validationError) {
      this.setData({
        pickupNameError: this.data.pickupName.trim()
          ? ''
          : '请输入取货人姓名',
        phoneError: /^1\d{10}$/.test(this.data.phone)
          ? ''
          : '请输入正确的11位手机号',
      })
      return
    }

    this.setData({ saving: true, error: '' })
    try {
      await profileService.save({
        pickupName: this.data.pickupName.trim(),
        phone: this.data.phone,
      })
      const current = sessionStore.current()
      if (current) sessionStore.save({ ...current, profileComplete: true })
      wx.navigateBack({
        success: () =>
          wx.showToast({ title: '取货信息已保存', icon: 'success' }),
      })
    } catch (error) {
      this.setData({
        error: error instanceof Error ? error.message : '取货信息保存失败',
      })
    } finally {
      this.setData({ saving: false })
    }
  },

  onRetry() {
    void this.loadProfile()
  },
})
