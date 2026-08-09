import {
  orderStatusLabel,
  type MerchantOrder,
  type OrderStatus,
} from './order'

export type DashboardOrderCounts = Record<OrderStatus, number>

export interface MerchantDashboardSummary {
  orderCounts: DashboardOrderCounts
  lowStockCount: number
  waitingConversationCount: number
  latestOrders: MerchantOrder[]
}

export interface ActiveOrderMetric {
  status: 'PENDING_CONFIRMATION' | 'PREPARING' | 'READY_FOR_PICKUP'
  label: string
  count: number
}

const ACTIVE_ORDER_STATUSES: readonly ActiveOrderMetric['status'][] = [
  'PENDING_CONFIRMATION',
  'PREPARING',
  'READY_FOR_PICKUP',
]

export const summarizeActiveOrders = (
  counts: DashboardOrderCounts,
): ActiveOrderMetric[] => ACTIVE_ORDER_STATUSES.map((status) => ({
  status,
  label: orderStatusLabel[status],
  count: counts[status] || 0,
}))

export const dashboardOrderDestination = (status: OrderStatus): string =>
  `/pages/orders/index?status=${status}`
