import { describe, expect, it } from 'vitest'
import {
  buildProfileView,
  validateProfile,
} from '../miniprogram/pages/profile/presentation'
import { resolveTabNavigation } from '../miniprogram/components/app-tab-bar/navigation'

describe('profile presentation', () => {
  it('shows an actionable logged-out state when no session exists', () => {
    expect(buildProfileView(false)).toEqual({
      loggedIn: false,
      displayName: '登录 / 注册',
      pickupSummary: '同步订单与购物车',
    })
  })

  it('summarizes saved pickup information for a logged-in customer', () => {
    expect(
      buildProfileView(true, {
        pickupName: '李先生',
        phone: '13800138000',
      }),
    ).toEqual({
      loggedIn: true,
      displayName: '李先生',
      pickupSummary: '138****8000',
    })
  })

  it('rejects incomplete pickup information before sending it', () => {
    expect(validateProfile('', '13800138000')).toBe('请输入取货人姓名')
    expect(validateProfile('李先生', '123')).toBe('请输入正确的11位手机号')
    expect(validateProfile('李先生', '13800138000')).toBeUndefined()
  })
})

describe('four-item primary navigation', () => {
  it('routes every primary destination without stacking top-level pages', () => {
    expect(resolveTabNavigation('profile', 'home')).toEqual({
      method: 'reLaunch',
      url: '/pages/home/index',
    })
    expect(resolveTabNavigation('profile', 'category')).toEqual({
      method: 'redirectTo',
      url: '/pages/category/index',
    })
    expect(resolveTabNavigation('home', 'cart')).toEqual({
      method: 'redirectTo',
      url: '/pages/cart/index',
    })
    expect(resolveTabNavigation('home', 'profile')).toEqual({
      method: 'redirectTo',
      url: '/pages/profile/index',
    })
    expect(resolveTabNavigation('profile', 'profile')).toEqual({
      method: 'none',
    })
  })
})
