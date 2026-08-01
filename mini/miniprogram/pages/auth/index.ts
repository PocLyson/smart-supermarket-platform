import { authService } from '../../services/auth'

Page({
  data: {
    agreed: false,
    loading: false,
    error: '',
  },

  async onAuthorize() {
    if (this.data.loading) return
    if (!this.data.agreed) {
      this.setData({
        error: '请先阅读并同意《用户服务协议》和《隐私政策》',
      })
      return
    }
    this.setData({ loading: true, error: '' })
    try {
      await authService.loginWithWechat()
      wx.showToast({ title: '登录成功', icon: 'success' })
      const pages = getCurrentPages()
      if (pages.length > 1) {
        wx.navigateBack({ delta: 1 })
      } else {
        wx.reLaunch({ url: '/pages/profile/index' })
      }
    } catch (error) {
      this.setData({
        error: error instanceof Error ? error.message : '登录失败，请重试',
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  onToggleConsent() {
    this.setData({
      agreed: !this.data.agreed,
      error: '',
    })
  },

  onOpenLegal(event: WechatMiniprogram.TouchEvent) {
    const type = event.currentTarget.dataset.type as 'terms' | 'privacy'
    wx.navigateTo({
      url: `/pages/legal/index?type=${type}`,
    })
  },

  onCancel() {
    const pages = getCurrentPages()
    if (pages.length > 1) {
      wx.navigateBack({ delta: 1 })
    } else {
      wx.reLaunch({ url: '/pages/home/index' })
    }
  },
})
