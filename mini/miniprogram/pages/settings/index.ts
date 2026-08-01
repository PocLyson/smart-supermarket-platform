import { profileService } from '../../services/auth'
import { clearLocalUsageData } from '../../store/local-usage-data'
import { sessionStore } from '../../store/session'
import {
  ACCOUNT_DELETION_SUCCESS_FEEDBACK,
  buildSettingsView,
  canClearLocalUsage,
  completeAccountDeletion,
  completeLogout,
  confirmAccountDeletion,
  confirmLocalUsageCleanup,
  LOCAL_CLEANUP_SUCCESS_FEEDBACK,
  LOGOUT_SUCCESS_FEEDBACK,
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

const returnToProfile = (): Promise<void> =>
  new Promise((resolve) => {
    wx.navigateBack({
      success: () => resolve(),
      fail: () =>
        wx.reLaunch({
          url: '/pages/profile/index',
          complete: () => resolve(),
        }),
    })
  })

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

  onPickupInfo() {
    wx.navigateTo({ url: '/pages/pickup-info/index' })
  },

  async onClearLocalData() {
    if (!canClearLocalUsage(this.data.loggedIn, this.data.clearing)) return
    const confirmed = await confirmLocalUsageCleanup(showConfirmation)
    if (!confirmed) return

    this.setData({ clearing: true, error: '' })
    try {
      clearLocalUsageData()
      wx.showToast(LOCAL_CLEANUP_SUCCESS_FEEDBACK)
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
        void completeLogout({
          clearSession: () => sessionStore.clear(),
          showSuccess: () =>
            wx.showToast(LOGOUT_SUCCESS_FEEDBACK),
          returnToProfile,
        })
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
      await completeAccountDeletion({
        clearLocalUsage: clearLocalUsageData,
        clearSession: () => sessionStore.clear(),
        clearAllStorage: () => wx.clearStorageSync(),
        showSuccess: () =>
          wx.showToast(ACCOUNT_DELETION_SUCCESS_FEEDBACK),
        returnToProfile,
      })
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
