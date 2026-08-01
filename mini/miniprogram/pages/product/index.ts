import { catalogService } from '../../services/catalog'
import { cart } from '../../store/cart'
import type { ProductDetail } from '../../types/catalog'
import { requireCustomerLogin } from '../../utils/auth-guard'
import { formatMoney } from '../../utils/money'

Page({
  data: {
    product: undefined as ProductDetail | undefined,
    loading: true,
    error: '',
    productId: 0,
    displayPrice: '',
    outOfStock: false,
    quantity: 1,
    imageFailed: false,
    fallbackImage: '/assets/icons/image-placeholder.svg',
  },

  onLoad(query: Record<string, string | undefined>) {
    const id = Number(query.id)
    if (!Number.isSafeInteger(id) || id <= 0) {
      this.setData({ loading: false, error: '商品参数无效' })
      return
    }
    this.setData({ productId: id })
    void this.loadProduct(id)
  },

  async loadProduct(id: number) {
    this.setData({ loading: true, error: '' })
    try {
      const product = await catalogService.getProduct(id)
      this.setData({
        product,
        displayPrice: formatMoney(product.priceCent),
        outOfStock: product.availableStock <= 0,
      })
    } catch (error) {
      this.setData({
        error: error instanceof Error ? error.message : '商品加载失败',
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  onAddToCart() {
    const product = this.data.product
    if (!product || this.data.outOfStock) return
    if (!requireCustomerLogin()) return
    for (let count = 0; count < this.data.quantity; count += 1) {
      cart.add({
        productId: product.id,
        name: product.name,
        coverImageUrl: product.coverImageUrl,
        unitPriceCent: product.priceCent,
      })
    }
    wx.showToast({ title: '已加入购物车', icon: 'success' })
  },

  onOpenCart() {
    wx.navigateTo({ url: '/pages/cart/index' })
  },

  onRetry() {
    if (this.data.productId) void this.loadProduct(this.data.productId)
  },

  onDecreaseQuantity() {
    if (this.data.quantity > 1) {
      this.setData({ quantity: this.data.quantity - 1 })
    }
  },

  onIncreaseQuantity() {
    this.setData({ quantity: this.data.quantity + 1 })
  },

  onImageError() {
    this.setData({ imageFailed: true })
  },
})
