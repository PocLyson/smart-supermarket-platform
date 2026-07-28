import { describe, expect, it } from 'vitest'
import { resolveTabNavigation } from '../miniprogram/components/app-tab-bar/navigation'
import { validateCheckoutFields } from '../miniprogram/pages/checkout/presentation'
import { buildOrderStatusPresentation } from '../miniprogram/pages/order-detail/presentation'
import { formatMoney } from '../miniprogram/utils/money'

describe('mini-program UI presentation', () => {
  it('opens category as its own top-level destination', () => {
    expect(resolveTabNavigation('home', 'category')).toEqual({
      method: 'redirectTo',
      url: '/pages/category/index',
    })
  })

  it('places checkout validation messages beside the invalid fields', () => {
    expect(validateCheckoutFields('', '123')).toEqual({
      pickupNameError: '请填写取货人姓名',
      phoneError: '请输入正确的11位手机号',
    })
  })

  it('describes each order state with a useful next step', () => {
    expect(buildOrderStatusPresentation('READY_FOR_PICKUP')).toEqual({
      title: '商品已备好',
      description: '请到鲁能超市李老家分店付款取货',
    })
    expect(buildOrderStatusPresentation('CANCELLED')).toEqual({
      title: '订单已取消',
      description: '如有疑问，请联系门店工作人员',
    })
  })

  it('formats every customer-facing amount with two decimals', () => {
    expect(formatMoney(590)).toBe('¥5.90')
    expect(formatMoney(128000)).toBe('¥1,280.00')
  })
})
