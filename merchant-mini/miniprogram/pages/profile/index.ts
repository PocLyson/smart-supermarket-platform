import { shortcutsForRole } from '../../components/app-tab-bar/navigation'
import { merchantSessionStore, type MerchantSession } from '../../store/session'

Page({
  data: {
    session: null as MerchantSession | null,
    shortcuts: shortcutsForRole('CASHIER'),
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
})
