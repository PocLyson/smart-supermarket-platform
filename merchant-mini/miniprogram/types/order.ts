import type { MerchantRole } from '../store/session'

export type OrderStatus =
  | 'PENDING_CONFIRMATION'
  | 'PREPARING'
  | 'READY_FOR_PICKUP'
  | 'COMPLETED'
  | 'CANCELLED'

export type PaymentStatus = 'UNPAID' | 'PAID'
export type PaymentMethod = 'CASH' | 'WECHAT_QR'
export type OrderPrimaryAction = 'ACCEPT' | 'MARK_READY' | 'MARK_PAID'

export interface MerchantOrderItem {
  productId: number
  productName: string
  unit: string
  unitPriceCent: number
  quantity: number
  subtotalCent: number
}

export interface MerchantOrderHistory {
  fromStatus?: OrderStatus | null
  toStatus: OrderStatus
  actorType: string
  actorId: number
  remark?: string | null
  createdAt: string
}

export interface MerchantOrder {
  orderNo: string
  totalCent: number
  status: OrderStatus
  paymentStatus: PaymentStatus
  paymentMethod?: PaymentMethod | null
  pickupName: string
  phone: string
  customerNote?: string | null
  cancelledBy?: string | null
  cancelReason?: string | null
  createdAt: string
  items: MerchantOrderItem[]
  history: MerchantOrderHistory[]
}

export interface MerchantOrderPage {
  items: MerchantOrder[]
  total: number
  page: number
  size: number
}

export interface MerchantOrderListQuery {
  status?: OrderStatus | ''
  paymentStatus?: PaymentStatus | ''
  keyword?: string
  page: number
  size: number
}

export interface OrderListContext {
  status: OrderStatus | ''
  paymentStatus: PaymentStatus | ''
  keyword: string
  page: number
  scrollTop: number
}

export const ORDER_STATUS_TABS = [
  { value: '', label: '全部' },
  { value: 'PENDING_CONFIRMATION', label: '待接单' },
  { value: 'PREPARING', label: '备货中' },
  { value: 'READY_FOR_PICKUP', label: '待取货' },
  { value: 'COMPLETED', label: '已完成' },
  { value: 'CANCELLED', label: '已取消' },
] as const

export const orderStatusLabel: Record<OrderStatus, string> = {
  PENDING_CONFIRMATION: '待接单',
  PREPARING: '备货中',
  READY_FOR_PICKUP: '待取货',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
}

export const paymentStatusLabel: Record<PaymentStatus, string> = {
  UNPAID: '未付款',
  PAID: '已付款',
}

export const paymentMethodLabel: Record<PaymentMethod, string> = {
  CASH: '现金',
  WECHAT_QR: '微信收款码',
}

const ACTIVE_STATUSES: readonly OrderStatus[] = [
  'PENDING_CONFIRMATION',
  'PREPARING',
  'READY_FOR_PICKUP',
]

export const orderAction = (
  status: OrderStatus,
  _role: MerchantRole,
): OrderPrimaryAction | undefined => ({
  PENDING_CONFIRMATION: 'ACCEPT',
  PREPARING: 'MARK_READY',
  READY_FOR_PICKUP: 'MARK_PAID',
  COMPLETED: undefined,
  CANCELLED: undefined,
})[status] as OrderPrimaryAction | undefined

export const availableOrderAction = (
  status: OrderStatus,
  role: MerchantRole,
  paymentStatus: PaymentStatus,
): OrderPrimaryAction | undefined => {
  const action = orderAction(status, role)
  return action === 'MARK_PAID' && paymentStatus === 'PAID' ? undefined : action
}

export const canOwnerCancel = (
  status: OrderStatus,
  role: MerchantRole,
): boolean => role === 'OWNER' && ACTIVE_STATUSES.includes(status)

export const maskPhone = (phone: string): string => {
  const value = phone.trim()
  if (!value) return '未提供'
  if (/^\d{11}$/.test(value)) return `${value.slice(0, 3)}****${value.slice(-4)}`
  return value.length > 7
    ? `${value.slice(0, 3)}****${value.slice(-4)}`
    : '号码已隐藏'
}

export const formatMoney = (cent: number): string => `¥${(cent / 100).toFixed(2)}`

export const formatOrderTime = (value: string): string => {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return value
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const safeBusinessMessage = /^[\u3400-\u9fffA-Za-z0-9，。！？：；、“”‘’（）()《》【】\-_\s]{1,80}$/u

export const readableOrderError = (error: unknown): string => {
  const message = error instanceof Error ? error.message.trim() : ''
  return safeBusinessMessage.test(message) ? message : '订单操作失败，请重试'
}

const numberOrZero = (value: string | undefined): number => {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0
}

const isOrderStatus = (value: string): value is OrderStatus =>
  ORDER_STATUS_TABS.some((item) => item.value === value) && value !== ''

const isPaymentStatus = (value: string): value is PaymentStatus =>
  value === 'UNPAID' || value === 'PAID'

export const buildOrderDetailUrl = (
  orderNo: string,
  context: OrderListContext,
): string => {
  const entries = [
    ['orderNo', orderNo],
    ['status', context.status],
    ['paymentStatus', context.paymentStatus],
    ['keyword', context.keyword],
    ['page', String(context.page)],
    ['scrollTop', String(context.scrollTop)],
  ] as const
  return `/pages/order-detail/index?${entries
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&')}`
}

export const parseOrderListContext = (query: string): OrderListContext => {
  const values = Object.fromEntries(
    query.split('&').map((entry) => {
      const [key, value = ''] = entry.split('=', 2)
      return [decodeURIComponent(key), decodeURIComponent(value)]
    }),
  )
  return {
    status: isOrderStatus(values.status || '') ? values.status as OrderStatus : '',
    paymentStatus: isPaymentStatus(values.paymentStatus || '')
      ? values.paymentStatus as PaymentStatus
      : '',
    keyword: values.keyword || '',
    page: numberOrZero(values.page),
    scrollTop: numberOrZero(values.scrollTop),
  }
}
