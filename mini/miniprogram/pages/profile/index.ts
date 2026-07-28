import { authService, profileService } from '../../services/auth'
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

  async onLogin() {
    this.setData({ loading: true, error: '' })
    try {
      await authService.loginWithWechat()
      await this.loadProfile()
    } catch (error) {
      this.setData({
        error: error instanceof Error ? error.message : '登录失败，请重试',
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  onPickupNameInput(event: WechatMiniprogram.Input) {
    this.setData({ pickupName: event.detail.value })
  },

  onPhoneInput(event: WechatMiniprogram.Input) {
    this.setData({ phone: event.detail.value })
  },

  async onSave() {
    const error = validateProfile(this.data.pickupName, this.data.phone)
    if (error) {
      wx.showToast({ title: error, icon: 'none' })
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

  onLogout() {
    wx.showModal({
      title: '退出登录',
      content: '退出后将无法查看个人订单，确定退出吗？',
      success: ({ confirm }) => {
        if (!confirm) return
        sessionStore.clear()
        this.setData({
          ...loggedOutView,
          pickupName: '',
          phone: '',
          error: '',
        })
      },
    })
  },
})
