import { profileService } from '../../services/auth'
import { clearLocalUsageData } from '../../store/local-usage-data'
import { sessionStore } from '../../store/session'
import {
  buildSettingsView,
  confirmAccountDeletion,
  confirmLocalUsageCleanup,
  type ConfirmationOptions,
} from './presentation'

const showConfirmation = (
  options: ConfirmationOptions,
): Promise<boolean> =>
  new Promise((resolve) => {
    wx.showModal({
      ...options,
      cancelText: '取消',
      success: ({ confirm }) => resolve(confirm),
      fail: () => resolve(false),
    })
  })

const returnToProfile = (): void => {
  wx.navigateBack({
    fail: () => wx.reLaunch({ url: '/pages/profile/index' }),
  })
}

Page({
  data: {
    ...buildSettingsView(false),
    clearing: false,
    deleting: false,
    error: '',
  },

  onShow() {
    this.setData({
      ...buildSettingsView(Boolean(sessionStore.current())),
      error: '',
    })
  },

  onTerms() {
    wx.navigateTo({
      url: '/pages/legal/index?type=terms',
      fail: () =>
        wx.showToast({ title: '页面暂时无法打开', icon: 'none' }),
    })
  },

  onPrivacy() {
    wx.navigateTo({
      url: '/pages/legal/index?type=privacy',
      fail: () =>
        wx.showToast({ title: '页面暂时无法打开', icon: 'none' }),
    })
  },

  async onClearLocalData() {
    if (this.data.clearing) return
    const confirmed = await confirmLocalUsageCleanup(showConfirmation)
    if (!confirmed) return

    this.setData({ clearing: true, error: '' })
    try {
      clearLocalUsageData()
      wx.showToast({ title: '本地使用记录已清除', icon: 'success' })
    } catch {
      this.setData({ error: '本地记录清除失败，请稍后重试' })
    } finally {
      this.setData({ clearing: false })
    }
  },

  onLogout() {
    wx.showModal({
      title: '退出登录',
      content: '退出后将无法查看个人订单，确定退出吗？',
      cancelText: '取消',
      success: ({ confirm }) => {
        if (!confirm) return
        sessionStore.clear()
        returnToProfile()
      },
    })
  },

  async onDeleteAccount() {
    if (this.data.deleting) return
    const confirmed = await confirmAccountDeletion(showConfirmation)
    if (!confirmed) return

    this.setData({ deleting: true, error: '' })
    try {
      await profileService.deleteAccount()
      clearLocalUsageData()
      sessionStore.clear()
      wx.clearStorageSync()
      wx.showToast({ title: '账号已注销', icon: 'success' })
      returnToProfile()
    } catch (error) {
      this.setData({
        error:
          error instanceof Error
            ? error.message
            : '账号暂时无法注销，请稍后重试',
      })
    } finally {
      this.setData({ deleting: false })
    }
  },
})
