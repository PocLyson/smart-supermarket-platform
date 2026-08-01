import { sessionStore } from '../store/session'

export const requireCustomerLogin = (): boolean => {
  if (sessionStore.current()) return true

  wx.showModal({
    title: '登录后继续',
    content: '登录后可加入购物车并提交订单',
    confirmText: '去登录',
    cancelText: '暂不登录',
    success: ({ confirm }) => {
      if (confirm) {
        wx.navigateTo({ url: '/pages/auth/index' })
      }
    },
  })
  return false
}
