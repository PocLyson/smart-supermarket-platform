import { authService } from '../../services/auth'

Page({
  data: {
    loading: false,
    error: '',
  },

  async onAuthorize() {
    if (this.data.loading) return
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

  onCancel() {
    const pages = getCurrentPages()
    if (pages.length > 1) {
      wx.navigateBack({ delta: 1 })
    } else {
      wx.reLaunch({ url: '/pages/home/index' })
    }
  },
})
