export interface SettingsView {
  loggedIn: boolean
  accountStatus: string
}

export interface ConfirmationOptions {
  title: string
  content: string
  confirmText: string
  confirmColor?: string
}

export type ShowConfirmation = (
  options: ConfirmationOptions,
) => Promise<boolean>

export const buildSettingsView = (loggedIn: boolean): SettingsView => ({
  loggedIn,
  accountStatus: loggedIn ? '微信账号 · 已登录' : '未登录',
})

export const confirmLocalUsageCleanup = (
  showConfirmation: ShowConfirmation,
): Promise<boolean> =>
  showConfirmation({
    title: '清除本地使用记录',
    content:
      '将清除本机购物车、搜索记录和待提交订单，不会删除账号、历史订单或默认取货信息。',
    confirmText: '确认清除',
  })

export const confirmAccountDeletion = async (
  showConfirmation: ShowConfirmation,
): Promise<boolean> => {
  const understood = await showConfirmation({
    title: '注销账号',
    content:
      '存在未完成订单时无法注销。注销后将删除个人资料和登录信息；依法需要保存的订单记录仍会保留。',
    confirmText: '继续',
  })
  if (!understood) return false

  return showConfirmation({
    title: '再次确认注销',
    content: '账号注销后无法恢复，确定继续吗？',
    confirmText: '确认注销',
    confirmColor: '#D54941',
  })
}
