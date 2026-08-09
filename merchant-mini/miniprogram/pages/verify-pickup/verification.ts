import type {
  MerchantOrder,
  PaymentMethod,
  PaymentStatus,
} from '../../types/order'
import {
  formatMoney,
  maskPhone,
  paymentStatusLabel,
  readableOrderError,
} from '../../types/order'

export interface PickupScan {
  pickupCode: string
}

export interface PickupPreview extends MerchantOrder {
  amountText: string
  maskedPickupName: string
  maskedPhone: string
  paymentLabel: string
  itemSummary: string
}

export const parsePickupScan = (raw: string): PickupScan => {
  const pickupCode = raw.trim()
  if (!/^\d{6}$/.test(pickupCode)) throw new Error('请输入6位取货码')
  return { pickupCode }
}

export const paymentOptionsFor = (
  paymentStatus: PaymentStatus,
): PaymentMethod[] => paymentStatus === 'UNPAID' ? ['CASH', 'WECHAT_QR'] : []

export const resolvePayAtStoreMethod = (
  order: MerchantOrder,
  selectedMethod: PaymentMethod | '',
): PaymentMethod => {
  if (order.paymentStatus === 'UNPAID') {
    if (selectedMethod !== 'CASH' && selectedMethod !== 'WECHAT_QR') {
      throw new Error('请选择收款方式')
    }
    return selectedMethod
  }
  return order.paymentMethod || 'WECHAT_QR'
}

const maskPickupName = (name: string): string => {
  const value = name.trim()
  if (!value) return '取货人已隐藏'
  if (value.length === 1) return '*'
  return `${value.slice(0, 1)}${'*'.repeat(Math.min(3, value.length - 1))}`
}

export const presentPickupPreview = (order: MerchantOrder): PickupPreview => {
  const itemCount = order.items.reduce((total, item) => total + item.quantity, 0)
  const names = order.items.slice(0, 2).map(({ productName }) => productName).join('、')
  return {
    ...order,
    amountText: formatMoney(order.totalCent),
    maskedPickupName: maskPickupName(order.pickupName),
    maskedPhone: maskPhone(order.phone),
    paymentLabel: paymentStatusLabel[order.paymentStatus],
    itemSummary: names
      ? `${names}${order.items.length > 2 ? '等' : ''}，共${itemCount}件`
      : '暂无商品明细',
  }
}

const pickupErrorByCode: Record<string, string> = {
  PICKUP_CODE_MISMATCH: '取货码不正确，请与顾客核对后重试',
  ORDER_ALREADY_COMPLETED: '订单已完成，无需重复核销',
  ORDER_STATE_CONFLICT: '订单状态已变化，可能已完成或暂不允许核销，请重新加载订单确认',
  ORDER_STATUS_CONFLICT: '订单状态已变化，暂不能核销，请重新加载后重试',
  INVALID_ORDER_STATUS: '订单当前状态不允许核销，请重新加载后重试',
}

export const readablePickupError = (error: unknown): string => {
  const code = error && typeof error === 'object' && 'code' in error
    ? String((error as { code?: unknown }).code || '')
    : ''
  if (pickupErrorByCode[code]) return pickupErrorByCode[code]
  const message = readableOrderError(error)
  if (message.includes('网络')) return '网络连接失败，请检查网络后重试'
  return message === '订单操作失败，请重试' ? '核销失败，请重试' : message
}
