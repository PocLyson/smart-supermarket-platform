import type { MerchantRole } from '../../store/session'

export type MerchantTab = 'workbench' | 'orders' | 'verification' | 'messages' | 'profile'

export interface NavigationItem {
  id: MerchantTab
  label: string
  icon: string
  url: string
}

export const NAV_ITEMS: readonly NavigationItem[] = [
  { id: 'workbench', label: '工作台', icon: '/assets/icons/workbench.svg', url: '/pages/workbench/index' },
  { id: 'orders', label: '订单', icon: '/assets/icons/orders.svg', url: '/pages/orders/index' },
  { id: 'verification', label: '核销', icon: '/assets/icons/verification.svg', url: '/pages/messages-unavailable/index?feature=verification' },
  { id: 'messages', label: '消息', icon: '/assets/icons/messages.svg', url: '/pages/messages-unavailable/index?feature=messages' },
  { id: 'profile', label: '我的', icon: '/assets/icons/profile.svg', url: '/pages/profile/index' },
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
