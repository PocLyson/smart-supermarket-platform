import { merchantAuthService } from '../../services/auth'
import { merchantSessionStore, type MerchantSession } from '../../store/session'

const requestUnbindConfirmation = (): Promise<boolean> =>
  new Promise((resolve) => {
    wx.showModal({
      title: '解绑当前微信',
      content: '解绑后将退出商家端，下次登录需要使用员工账号和密码重新绑定当前微信。',
      confirmText: '确认解绑',
      success: ({ confirm }) => resolve(confirm),
      fail: () => resolve(false),
    })
  })

const requestLogoutConfirmation = (): Promise<boolean> =>
  new Promise((resolve) => {
    wx.showModal({
      title: '退出登录',
      content: '退出后需要重新登录商家端，确认退出吗？',
      confirmText: '确认退出',
      cancelText: '取消',
      success: ({ confirm }) => resolve(confirm),
      fail: () => resolve(false),
    })
  })

Page({
  data: {
    session: null as MerchantSession | null,
    isLoading: false,
    isUnbinding: false,
    errorMessage: '',
  },

  onShow() {
    const session = merchantSessionStore.current()
    if (!session) {
      wx.reLaunch({ url: '/pages/login/index' })
      return
    }
    this.setData({ session })
  },

  goBack() {
    wx.navigateBack({ delta: 1 })
  },

  async confirmUnbind() {
    if (this.data.isLoading || this.data.isUnbinding) return
    this.setData({ isUnbinding: true, errorMessage: '' })
    try {
      if (!await requestUnbindConfirmation()) return
      await merchantAuthService.unbindWechat()
      wx.showToast({ title: '微信已解绑', icon: 'success' })
      wx.reLaunch({ url: '/pages/login/index' })
    } catch (error) {
      this.setData({
        errorMessage: error instanceof Error && error.message.trim()
          ? error.message
          : '解绑失败，请重试',
      })
    } finally {
      this.setData({ isUnbinding: false })
    }
  },

  async logout() {
    if (this.data.isLoading || this.data.isUnbinding) return
    this.setData({ isLoading: true })
    try {
      if (!await requestLogoutConfirmation()) return
      try {
        await merchantAuthService.logout()
      } catch (error) {
        wx.showToast({
          title: '已退出本机，服务端注销状态未确认',
          icon: 'none',
        })
      }
      wx.reLaunch({ url: '/pages/login/index' })
    } finally {
      this.setData({ isLoading: false })
    }
  },
})
