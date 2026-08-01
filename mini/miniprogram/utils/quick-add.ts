import { cart } from '../store/cart'
import type { ProductSummary } from '../types/catalog'
import { requireCustomerLogin } from './auth-guard'

export const quickAddProduct = (
  product: Pick<
    ProductSummary,
    'id' | 'name' | 'coverImageUrl' | 'priceCent' | 'availableStock'
  >,
): boolean => {
  if (product.availableStock <= 0) {
    wx.showToast({
      title: '库存不足，暂时无法加入购物车',
      icon: 'none',
    })
    return false
  }
  if (!requireCustomerLogin()) return false

  cart.add({
    productId: product.id,
    name: product.name,
    coverImageUrl: product.coverImageUrl,
    unitPriceCent: product.priceCent,
  })
  wx.showToast({ title: '已加入购物车', icon: 'success' })
  return true
}
