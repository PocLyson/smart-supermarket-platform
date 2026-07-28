export type PrimaryTab = 'home' | 'category' | 'cart' | 'profile'

export type TabNavigation =
  | { method: 'none' }
  | { method: 'reLaunch' | 'redirectTo'; url: string }

const destinations: Record<
  Exclude<PrimaryTab, 'home' | 'category'>,
  string
> = {
  cart: '/pages/cart/index',
  profile: '/pages/profile/index',
}

export const resolveTabNavigation = (
  current: PrimaryTab,
  target: PrimaryTab,
): TabNavigation => {
  if (current === target) return { method: 'none' }
  if (target === 'home') {
    return { method: 'reLaunch', url: '/pages/home/index' }
  }
  if (target === 'category') {
    return {
      method: 'reLaunch',
      url: '/pages/home/index?section=category',
    }
  }
  return { method: 'redirectTo', url: destinations[target] }
}
