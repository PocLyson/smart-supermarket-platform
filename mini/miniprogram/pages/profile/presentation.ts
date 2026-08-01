import type { CustomerProfile } from '../../services/auth'
import type { OrderStatus } from '../../types/order'

export interface ProfileView {
  loggedIn: boolean
  displayName: string
  pickupSummary: string
}

export interface ActiveOrderCounts {
  pendingConfirmation: number
  preparing: number
  readyForPickup: number
}

export const buildActiveOrderCounts = (
  statuses: OrderStatus[],
): ActiveOrderCounts =>
  statuses.reduce<ActiveOrderCounts>(
    (counts, status) => {
      if (status === 'PENDING_CONFIRMATION') counts.pendingConfirmation += 1
      if (status === 'PREPARING') counts.preparing += 1
      if (status === 'READY_FOR_PICKUP') counts.readyForPickup += 1
      return counts
    },
    {
      pendingConfirmation: 0,
      preparing: 0,
      readyForPickup: 0,
    },
  )

const maskPhone = (phone: string): string =>
  /^1\d{10}$/.test(phone)
    ? `${phone.slice(0, 3)}****${phone.slice(-4)}`
    : '请完善手机号'

export const buildProfileView = (
  loggedIn: boolean,
  profile?: CustomerProfile,
): ProfileView => {
  if (!loggedIn) {
    return {
      loggedIn: false,
      displayName: '登录 / 注册',
      pickupSummary: '同步订单与购物车',
    }
  }
  return {
    loggedIn: true,
    displayName: profile?.pickupName || '已登录用户',
    pickupSummary: profile ? maskPhone(profile.phone) : '请完善取货信息',
  }
}

export const validateProfile = (
  pickupName: string,
  phone: string,
): string | undefined => {
  if (!pickupName.trim()) return '请输入取货人姓名'
  if (!/^1\d{10}$/.test(phone)) return '请输入正确的11位手机号'
  return undefined
}
