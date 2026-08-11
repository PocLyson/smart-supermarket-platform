import { shortcutsForRole } from '../../components/app-tab-bar/navigation'
import { merchantAuthService } from '../../services/auth'
import { merchantSessionStore, type MerchantSession } from '../../store/session'

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
    shortcuts: shortcutsForRole('CASHIER'),
    isLoading: false,
  },

  onShow() {
    const session = merchantSessionStore.current()
    if (!session) {
      wx.reLaunch({ url: '/pages/login/index' })
      return
    }
    this.setData({ session, shortcuts: shortcutsForRole(session.role) })
  },

  onShortcutTap(event: WechatMiniprogram.TouchEvent) {
    const id = event.currentTarget.dataset.id as string
    const shortcut = this.data.shortcuts.find((item) => item.id === id)
    if (shortcut) wx.navigateTo({ url: shortcut.url })
  },

  async logout() {
    if (this.data.isLoading) return
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
