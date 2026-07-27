import {
  canCustomerCancel,
  orderStatusLabel,
} from '../miniprogram/types/order'

describe('customer order status', () => {
  it('allows customer cancellation only while pending confirmation', () => {
    expect(canCustomerCancel('PENDING_CONFIRMATION')).toBe(true)
    expect(canCustomerCancel('PREPARING')).toBe(false)
    expect(canCustomerCancel('READY_FOR_PICKUP')).toBe(false)
    expect(canCustomerCancel('COMPLETED')).toBe(false)
    expect(canCustomerCancel('CANCELLED')).toBe(false)
  })

  it('shows the frozen Chinese status labels', () => {
    expect(orderStatusLabel).toEqual({
      PENDING_CONFIRMATION: '待门店确认',
      PREPARING: '备货中',
      READY_FOR_PICKUP: '待取货',
      COMPLETED: '已完成',
      CANCELLED: '已取消',
    })
  })
})
