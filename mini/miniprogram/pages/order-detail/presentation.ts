import type {
  OrderStatus,
  OrderStatusHistory,
} from '../../types/order'

export interface OrderStatusPresentation {
  title: string
  description: string
}

const presentations: Record<OrderStatus, OrderStatusPresentation> = {
  PENDING_CONFIRMATION: {
    title: '订单已提交',
    description: '门店确认后会开始备货，请耐心等待',
  },
  PREPARING: {
    title: '门店正在备货',
    description: '备货完成后，订单会更新为待取货',
  },
  READY_FOR_PICKUP: {
    title: '商品已备好',
    description: '请到鲁能超市李老家分店付款取货',
  },
  COMPLETED: {
    title: '订单已完成',
    description: '感谢你的光临，期待下次再见',
  },
  CANCELLED: {
    title: '订单已取消',
    description: '如有疑问，请联系门店工作人员',
  },
}

export const buildOrderStatusPresentation = (
  status: OrderStatus,
): OrderStatusPresentation => presentations[status]

export const formatPickupCode = (pickupCode: string): string =>
  pickupCode.replace(/(\d{3})(\d{3})/, '$1 $2')

export interface PresentedOrderHistory {
  title: string
  description: string
  displayTime: string
}

const historyPresentations: Record<
  OrderStatus,
  Pick<PresentedOrderHistory, 'title' | 'description'>
> = {
  PENDING_CONFIRMATION: {
    title: '订单已提交',
    description: '订单已成功提交，等待门店确认',
  },
  PREPARING: {
    title: '门店已接单',
    description: '门店正在准备商品',
  },
  READY_FOR_PICKUP: {
    title: '可以到店取货',
    description: '商品已备好，请到门店付款取货',
  },
  COMPLETED: {
    title: '订单已完成',
    description: '商品已完成取货',
  },
  CANCELLED: {
    title: '订单已取消',
    description: '订单已取消，如有疑问请联系门店',
  },
}

const padTimePart = (value: number): string => String(value).padStart(2, '0')

const formatChinaTime = (value: string): string => {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  const chinaTime = new Date(parsed.getTime() + 8 * 60 * 60 * 1000)
  return [
    chinaTime.getUTCFullYear(),
    padTimePart(chinaTime.getUTCMonth() + 1),
    padTimePart(chinaTime.getUTCDate()),
  ].join('-') + ` ${padTimePart(chinaTime.getUTCHours())}:${padTimePart(chinaTime.getUTCMinutes())}`
}

export const presentOrderHistory = (
  history: OrderStatusHistory[] | undefined,
): PresentedOrderHistory[] =>
  (history || []).map((item) => {
    const presentation = historyPresentations[item.toStatus]
    return {
      ...presentation,
      description:
        item.toStatus === 'CANCELLED' && item.remark
          ? `取消原因：${item.remark}`
          : presentation.description,
      displayTime: formatChinaTime(item.createdAt),
    }
  })

const orderProductImages: Record<number, string> = {
  1: '/assets/categories/dairy.jpg',
  2: '/assets/categories/snacks.jpg',
  3: '/assets/categories/grain-oil.jpg',
  4: '/assets/categories/beverages.jpg',
  5: '/assets/categories/meat-eggs.jpg',
}

export const resolveOrderProductImage = (productId: number): string =>
  orderProductImages[Math.floor(productId / 100)] ??
  '/assets/icons/image-placeholder.svg'
