import type { OrderStatus, PaymentStatus } from '@/api/orders'

export const orderStatusLabel: Record<OrderStatus, string> = {
  PENDING_CONFIRMATION: '待门店确认',
  PREPARING: '备货中',
  READY_FOR_PICKUP: '待取货',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
}

export const paymentStatusLabel: Record<PaymentStatus, string> = {
  UNPAID: '未付款',
  PAID: '已付款',
}
