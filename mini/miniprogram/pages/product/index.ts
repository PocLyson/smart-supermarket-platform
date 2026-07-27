import { catalogService } from '../../services/catalog'
import { cart } from '../../store/cart'
import type { ProductDetail } from '../../types/catalog'

Page({
  data: {
    product: undefined as ProductDetail | undefined,
    loading: true,
    error: '',
  },

  onLoad(query: Record<string, string | undefined>) {
    const id = Number(query.id)
    if (!Number.isSafeInteger(id) || id <= 0) {
      this.setData({ loading: false, error: '商品参数无效' })
      return
    }
    void this.loadProduct(id)
  },

  async loadProduct(id: number) {
    this.setData({ loading: true, error: '' })
    try {
      this.setData({ product: await catalogService.getProduct(id) })
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
    if (!product) return
    cart.add({
      productId: product.id,
      name: product.name,
      coverImageUrl: product.coverImageUrl,
      unitPriceCent: product.priceCent,
    })
    wx.showToast({ title: '已加入购物车', icon: 'success' })
  },

  onOpenCart() {
    wx.navigateTo({ url: '/pages/cart/index' })
  },
})
