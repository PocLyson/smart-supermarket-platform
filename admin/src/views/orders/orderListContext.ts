import type { OrderStatus, PaymentStatus } from '@/api/orders'

export interface OrderListContext {
  status: '' | OrderStatus
  paymentStatus: '' | PaymentStatus
  keyword: string
  archived: boolean
  page: number
}

const orderStatuses: OrderStatus[] = [
  'PENDING_CONFIRMATION',
  'PREPARING',
  'READY_FOR_PICKUP',
  'COMPLETED',
  'CANCELLED',
]

const paymentStatuses: PaymentStatus[] = ['UNPAID', 'PAID']

const firstString = (value: unknown): string => {
  const first = Array.isArray(value) ? value[0] : value
  return typeof first === 'string' ? first : ''
}

export const parseOrderListContext = (
  query: Record<string, unknown> = {},
): OrderListContext => {
  const statusValue = firstString(query.status) as OrderStatus
  const paymentValue = firstString(query.paymentStatus) as PaymentStatus
  const pageValue = Number.parseInt(firstString(query.page), 10)
  return {
    status: orderStatuses.includes(statusValue) ? statusValue : '',
    paymentStatus: paymentStatuses.includes(paymentValue) ? paymentValue : '',
    keyword: firstString(query.keyword).trim(),
    archived: firstString(query.archived) === 'true',
    page: Number.isInteger(pageValue) && pageValue > 0 ? pageValue : 1,
  }
}

export const serializeOrderListContext = (
  context: OrderListContext,
): Record<string, string> => {
  const query: Record<string, string> = {}
  if (context.status) query.status = context.status
  if (context.paymentStatus) query.paymentStatus = context.paymentStatus
  if (context.keyword.trim()) query.keyword = context.keyword.trim()
  if (context.archived) query.archived = 'true'
  if (context.page > 1) query.page = String(context.page)
  return query
}
