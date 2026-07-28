import type { OrderStatus } from '../../types/order'

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
