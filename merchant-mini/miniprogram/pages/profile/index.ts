import { shortcutsForRole } from '../../components/app-tab-bar/navigation'
import { merchantAuthService } from '../../services/auth'
import { merchantSessionStore, type MerchantSession } from '../../store/session'

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
      await merchantAuthService.logout()
    } catch (error) {
      wx.showToast({
        title: '已退出本机，服务端注销状态未确认',
        icon: 'none',
      })
    } finally {
      this.setData({ isLoading: false })
      wx.reLaunch({ url: '/pages/login/index' })
    }
  },
})
