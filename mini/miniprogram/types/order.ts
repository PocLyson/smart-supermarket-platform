import type { PageResult } from './catalog'

export type OrderStatus =
  | 'PENDING_CONFIRMATION'
  | 'PREPARING'
  | 'READY_FOR_PICKUP'
  | 'COMPLETED'
  | 'CANCELLED'

export type PaymentStatus = 'UNPAID' | 'PAID'

export interface CreateOrderItem {
  productId: number
  quantity: number
}

export interface CreateOrderRequest {
  pickupName: string
  phone: string
  items: CreateOrderItem[]
}

export interface OrderItemSnapshot {
  productId: number
  productName: string
  unitPriceCent: number
  quantity: number
  subtotalCent: number
}

export interface OrderStatusHistory {
  fromStatus?: OrderStatus | null
  toStatus: OrderStatus
  actorType: string
  actorId: number
  remark?: string | null
  createdAt: string
}

export interface CustomerOrder {
  orderNo: string
  pickupCode: string
  status: OrderStatus
  paymentStatus: PaymentStatus
  pickupName: string
  phone: string
  totalCent: number
  items: OrderItemSnapshot[]
  history?: OrderStatusHistory[]
  cancellationReason?: string
  createdAt?: string
}

export type OrderPage = PageResult<CustomerOrder>

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

export const canCustomerCancel = (status: OrderStatus): boolean =>
  status === 'PENDING_CONFIRMATION'
