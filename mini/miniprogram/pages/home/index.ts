import { catalogService } from '../../services/catalog'
import type { Category, ProductSummary } from '../../types/catalog'
import { buildSearchUrl } from '../search/presentation'
import { formatMoney } from '../../utils/money'
import { quickAddProduct } from '../../utils/quick-add'
import {
  presentCategories,
  type PresentedCategory,
} from '../../config/category-presentation'

type ProductCard = ProductSummary & {
  displayPrice: string
  outOfStock: boolean
}

const pageSize = 10

Page({
  data: {
    categories: [] as Category[],
    categoryPresentation: [] as PresentedCategory[],
    products: [] as ProductCard[],
    selectedCategoryId: undefined as number | undefined,
    keyword: '',
    page: 0,
    loading: false,
    error: '',
    empty: false,
    reachedEnd: false,
    imageFailed: false,
    fallbackImage: '/assets/icons/image-placeholder.svg',
  },

  onLoad() {
    void this.loadInitial()
  },

  onReachBottom() {
    if (!this.data.loading && !this.data.reachedEnd) {
      void this.loadProducts(false)
    }
  },

  async loadInitial() {
    this.setData({ loading: true, error: '' })
    try {
      const categories = await catalogService.listCategories()
      const enabledCategories = categories.filter((item) => item.enabled)
      this.setData({
        categories: enabledCategories,
        categoryPresentation: presentCategories(enabledCategories),
      })
      await this.loadProducts(true)
    } catch (error) {
      this.setData({
        error: error instanceof Error ? error.message : '加载失败，请重试',
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  async loadProducts(reset: boolean) {
    if (this.data.loading && !reset) return
    const page = reset ? 0 : this.data.page
    this.setData({ loading: true, error: '' })
    try {
      const result = await catalogService.listProducts({
        categoryId: this.data.selectedCategoryId,
        keyword: this.data.keyword.trim() || undefined,
        page,
        size: pageSize,
      })
      const incoming = result.items.map((item) => ({
        ...item,
        displayPrice: formatMoney(item.priceCent),
        outOfStock: item.availableStock <= 0,
      }))
      const products = reset ? incoming : [...this.data.products, ...incoming]
      this.setData({
        products,
        page: page + 1,
        empty: products.length === 0,
        reachedEnd: products.length >= result.total || result.items.length < pageSize,
      })
    } catch (error) {
      this.setData({
        error: error instanceof Error ? error.message : '加载失败，请重试',
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  onKeywordInput(event: WechatMiniprogram.Input) {
    this.setData({ keyword: event.detail.value })
  },

  onSearch() {
    wx.navigateTo({ url: buildSearchUrl(this.data.keyword) })
  },

  onClearSearch() {
    this.setData({ keyword: '' })
    void this.loadProducts(true)
  },

  onSelectCategory(event: WechatMiniprogram.TouchEvent) {
    const categoryName = String(event.currentTarget.dataset.name || '')
    const matched = categoryName
      ? this.data.categories.find((item) => item.name === categoryName)
      : undefined
    const value = matched?.id ?? event.currentTarget.dataset.id
    const categoryId = value === 'all' ? '' : String(Number(value))
    wx.navigateTo({
      url: `/pages/category/index${categoryId ? `?categoryId=${categoryId}` : ''}`,
    })
  },

  onOpenProduct(event: WechatMiniprogram.TouchEvent) {
    wx.navigateTo({
      url: `/pages/product/index?id=${Number(event.currentTarget.dataset.id)}`,
    })
  },

  onQuickAdd(event: WechatMiniprogram.TouchEvent) {
    const productId = Number(event.currentTarget.dataset.id)
    const product = this.data.products.find((item) => item.id === productId)
    if (!product) return
    quickAddProduct(product)
  },

  onImageError() {
    this.setData({ imageFailed: true })
  },
})
