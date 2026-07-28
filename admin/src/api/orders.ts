import { jsonBody, request } from './http'
import type { PageResult } from '@/types/common'
import { toQueryString } from '@/utils/query'

export type OrderStatus =
  'PENDING_CONFIRMATION' | 'PREPARING' | 'READY_FOR_PICKUP' | 'COMPLETED' | 'CANCELLED'

export type PaymentStatus = 'UNPAID' | 'PAID'
export type PaymentMethod = 'CASH' | 'WECHAT_QR'

export interface AdminOrderSummary {
  orderNo: string
  pickupName: string
  phone: string
  totalCent: number
  status: OrderStatus
  paymentStatus: PaymentStatus
  paymentMethod: PaymentMethod | null
  cancelReason: string | null
  createdAt: string
}

export interface AdminOrderItem {
  productId: number
  productName: string
  unit: string
  unitPriceCent: number
  quantity: number
  subtotalCent: number
}

export interface OrderStatusHistoryItem {
  fromStatus: OrderStatus | null
  toStatus: OrderStatus
  actorType: 'CUSTOMER' | 'STAFF' | 'SYSTEM'
  actorId: number
  remark: string | null
  createdAt: string
}

export interface AdminOrderDetail extends AdminOrderSummary {
  items: AdminOrderItem[]
  history: OrderStatusHistoryItem[]
}

export interface AdminOrderQuery {
  status?: OrderStatus
  paymentStatus?: PaymentStatus
  keyword?: string
  page?: number
  size?: number
}

export interface ReasonRequest {
  reason: string
}

export interface PaymentRequest {
  method: PaymentMethod
}

export const listOrders = (query: AdminOrderQuery = {}): Promise<PageResult<AdminOrderSummary>> =>
  request(
    `/api/admin/orders${toQueryString({
      status: query.status,
      paymentStatus: query.paymentStatus,
      keyword: query.keyword,
      page: query.page,
      size: query.size,
    })}`,
  )

export const getOrder = (orderNo: string): Promise<AdminOrderDetail> =>
  request(`/api/admin/orders/${encodeURIComponent(orderNo)}`)

export const acceptOrder = (orderNo: string): Promise<void> =>
  request(`/api/admin/orders/${encodeURIComponent(orderNo)}/accept`, { method: 'POST' })

export const rejectOrder = (orderNo: string, payload: ReasonRequest): Promise<void> =>
  request(`/api/admin/orders/${encodeURIComponent(orderNo)}/reject`, {
    method: 'POST',
    ...jsonBody(payload),
  })

export const markOrderReady = (orderNo: string): Promise<void> =>
  request(`/api/admin/orders/${encodeURIComponent(orderNo)}/ready`, { method: 'POST' })

export const markOrderPaid = (orderNo: string, payload: PaymentRequest): Promise<void> =>
  request(`/api/admin/orders/${encodeURIComponent(orderNo)}/pay`, {
    method: 'POST',
    ...jsonBody(payload),
  })

export const completeOrder = (orderNo: string): Promise<void> =>
  request(`/api/admin/orders/${encodeURIComponent(orderNo)}/complete`, { method: 'POST' })

export const cancelOrder = (orderNo: string, payload: ReasonRequest): Promise<void> =>
  request(`/api/admin/orders/${encodeURIComponent(orderNo)}/cancel`, {
    method: 'POST',
    ...jsonBody(payload),
  })
