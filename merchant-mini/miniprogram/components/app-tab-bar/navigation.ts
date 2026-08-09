import type { MerchantRole } from '../../store/session'

export type MerchantTab = 'workbench' | 'orders' | 'verification' | 'messages' | 'profile'

export interface NavigationItem {
  id: MerchantTab
  label: string
  icon: string
  url: string
}

export const NAV_ITEMS: readonly NavigationItem[] = [
  { id: 'workbench', label: '工作台', icon: 'dashboard', url: '/pages/messages-unavailable/index?feature=workbench' },
  { id: 'orders', label: '订单', icon: 'file-1', url: '/pages/messages-unavailable/index?feature=orders' },
  { id: 'verification', label: '核销', icon: 'scan', url: '/pages/messages-unavailable/index?feature=verification' },
  { id: 'messages', label: '消息', icon: 'notification', url: '/pages/messages-unavailable/index?feature=messages' },
  { id: 'profile', label: '我的', icon: 'user', url: '/pages/profile/index' },
]

export interface MerchantShortcut {
  id: string
  label: string
  url: string
  ownerOnly: boolean
}

const SHORTCUTS: readonly MerchantShortcut[] = [
  {
    id: 'staff',
    label: '员工管理',
    url: '/pages/messages-unavailable/index?feature=staff',
    ownerOnly: true,
  },
  {
    id: 'account',
    label: '账号与微信',
    url: '/pages/profile/index',
    ownerOnly: false,
  },
]

export const shortcutsForRole = (role: MerchantRole): MerchantShortcut[] =>
  SHORTCUTS.filter((item) => !item.ownerOnly || role === 'OWNER').map((item) => ({ ...item }))
