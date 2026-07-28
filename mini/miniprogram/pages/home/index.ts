import { catalogService } from '../../services/catalog'
import type { Category, ProductSummary } from '../../types/catalog'

const pageSize = 10

Page({
  data: {
    categories: [] as Category[],
    products: [] as ProductSummary[],
    selectedCategoryId: undefined as number | undefined,
    keyword: '',
    page: 1,
    loading: false,
    error: '',
    empty: false,
    reachedEnd: false,
    categoryImages: [
      '/assets/categories/fruit.jpg',
      '/assets/categories/vegetables.jpg',
      '/assets/categories/dairy.jpg',
      '/assets/categories/snacks.jpg',
      '/assets/categories/grain-oil.jpg',
      '/assets/categories/meat-eggs.jpg',
      '/assets/categories/bakery.jpg',
      '/assets/categories/household.jpg',
      '/assets/categories/beverages.jpg',
    ],
  },

  onLoad(options: Record<string, string>) {
    void this.loadInitial().then(() => {
      if (options.section === 'category') this.onCategoryNav()
    })
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
      this.setData({ categories: categories.filter((item) => item.enabled) })
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
    const page = reset ? 1 : this.data.page
    this.setData({ loading: true, error: '' })
    try {
      const result = await catalogService.listProducts({
        categoryId: this.data.selectedCategoryId,
        keyword: this.data.keyword.trim() || undefined,
        page,
        size: pageSize,
      })
      const products = reset
        ? result.items
        : [...this.data.products, ...result.items]
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
    void this.loadProducts(true)
  },

  onCategoryNav() {
    wx.pageScrollTo({
      selector: '#category-section',
      duration: 200,
    })
  },

  onSelectCategory(event: WechatMiniprogram.TouchEvent) {
    const value = event.currentTarget.dataset.id
    this.setData({
      selectedCategoryId: value === 'all' ? undefined : Number(value),
    })
    void this.loadProducts(true)
  },

  onOpenProduct(event: WechatMiniprogram.TouchEvent) {
    wx.navigateTo({
      url: `/pages/product/index?id=${Number(event.currentTarget.dataset.id)}`,
    })
  },
})
