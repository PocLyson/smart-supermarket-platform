import { catalogService } from '../../services/catalog'
import type { Category, ProductSummary } from '../../types/catalog'
import { formatMoney } from '../../utils/money'
import {
  presentCategories,
  type PresentedCategory,
} from '../../config/category-presentation'

const pageSize = 12

type CategoryProduct = ProductSummary & { displayPrice: string }

Page({
  data: {
    categories: [] as Category[],
    categoryPresentation: [] as PresentedCategory[],
    selectedCategoryId: null as number | null,
    selectedCategoryName: '全部商品',
    products: [] as CategoryProduct[],
    page: 1,
    loading: false,
    error: '',
    empty: false,
    reachedEnd: false,
    imageFailed: false,
    fallbackImage: '/assets/icons/image-placeholder.svg',
  },

  onLoad(query: Record<string, string | undefined>) {
    const categoryId = Number(query.categoryId)
    if (Number.isSafeInteger(categoryId) && categoryId > 0) {
      this.setData({ selectedCategoryId: categoryId })
    }
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
      const categories = (await catalogService.listCategories()).filter(
        (item) => item.enabled,
      )
      const selected = categories.find(
        (item) => item.id === this.data.selectedCategoryId,
      )
      this.setData({
        categories,
        categoryPresentation: presentCategories(categories),
        selectedCategoryName: selected?.name || '全部商品',
      })
      await this.loadProducts(true)
    } catch (error) {
      this.setData({
        error: error instanceof Error ? error.message : '分类加载失败',
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  async loadProducts(reset: boolean) {
    const page = reset ? 1 : this.data.page
    this.setData({ loading: true, error: '' })
    try {
      const result = await catalogService.listProducts({
        categoryId: this.data.selectedCategoryId ?? undefined,
        page,
        size: pageSize,
      })
      const incoming = result.items.map((item) => ({
        ...item,
        displayPrice: formatMoney(item.priceCent),
      }))
      const products = reset ? incoming : [...this.data.products, ...incoming]
      this.setData({
        products,
        page: page + 1,
        empty: products.length === 0,
        reachedEnd:
          products.length >= result.total || result.items.length < pageSize,
      })
    } catch (error) {
      this.setData({
        error: error instanceof Error ? error.message : '商品加载失败',
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  onSelectCategory(event: WechatMiniprogram.TouchEvent) {
    const rawId = event.currentTarget.dataset.id
    const name = String(event.currentTarget.dataset.name || '')
    const selectedByName = name
      ? this.data.categories.find((item) => item.name === name)
      : undefined
    const categoryId =
      rawId === 'all'
        ? null
        : selectedByName?.id ?? Number(rawId)
    const selected =
      selectedByName ??
      this.data.categories.find((item) => item.id === categoryId)
    this.setData({
      selectedCategoryId: categoryId,
      selectedCategoryName: name || selected?.name || '全部商品',
    })
    void this.loadProducts(true)
  },

  onOpenSearch() {
    wx.navigateTo({ url: '/pages/search/index' })
  },

  onOpenProduct(event: WechatMiniprogram.TouchEvent) {
    wx.navigateTo({
      url: `/pages/product/index?id=${Number(event.currentTarget.dataset.id)}`,
    })
  },

  onImageError() {
    this.setData({ imageFailed: true })
  },
})
