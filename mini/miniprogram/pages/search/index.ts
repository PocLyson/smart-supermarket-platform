import { catalogService } from '../../services/catalog'
import type { ProductSummary } from '../../types/catalog'
import { formatMoney } from '../../utils/money'

const recentStorageKey = 'smart-store-recent-searches-v1'
const pageSize = 10

type SearchProduct = ProductSummary & { displayPrice: string }

const readRecentSearches = (): string[] => {
  const value = wx.getStorageSync(recentStorageKey) as unknown
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').slice(0, 6)
    : []
}

Page({
  data: {
    keyword: '',
    searchedKeyword: '',
    recentSearches: [] as string[],
    products: [] as SearchProduct[],
    page: 1,
    loading: false,
    error: '',
    hasSearched: false,
    empty: false,
    reachedEnd: false,
    imageFailed: false,
    fallbackImage: '/assets/icons/image-placeholder.svg',
    filterOpen: false,
    selectedPrice: 'all',
  },

  onLoad(query: Record<string, string | undefined>) {
    const keyword = query.keyword ? decodeURIComponent(query.keyword) : ''
    this.setData({ keyword, recentSearches: readRecentSearches() })
    if (keyword) void this.search(true)
  },

  onReachBottom() {
    if (
      this.data.hasSearched &&
      !this.data.loading &&
      !this.data.reachedEnd
    ) {
      void this.search(false)
    }
  },

  onKeywordInput(event: WechatMiniprogram.Input) {
    this.setData({ keyword: event.detail.value })
  },

  onSubmitSearch() {
    void this.search(true)
  },

  onUseRecent(event: WechatMiniprogram.TouchEvent) {
    this.setData({ keyword: String(event.currentTarget.dataset.keyword) })
    void this.search(true)
  },

  onClearKeyword() {
    this.setData({
      keyword: '',
      searchedKeyword: '',
      products: [],
      hasSearched: false,
      empty: false,
      error: '',
    })
  },

  onClearRecent() {
    wx.removeStorageSync(recentStorageKey)
    this.setData({ recentSearches: [] })
  },

  async search(reset: boolean) {
    const keyword = this.data.keyword.trim()
    if (!keyword) {
      wx.showToast({ title: '请输入商品名称', icon: 'none' })
      return
    }
    if (this.data.loading) return
    const page = reset ? 1 : this.data.page
    this.setData({ loading: true, error: '', hasSearched: true })
    try {
      const result = await catalogService.listProducts({
        keyword,
        page,
        size: pageSize,
      })
      const incoming = result.items.map((item) => ({
        ...item,
        displayPrice: formatMoney(item.priceCent),
      }))
      const products = reset ? incoming : [...this.data.products, ...incoming]
      const recentSearches = [
        keyword,
        ...this.data.recentSearches.filter((item) => item !== keyword),
      ].slice(0, 6)
      wx.setStorageSync(recentStorageKey, recentSearches)
      this.setData({
        searchedKeyword: keyword,
        recentSearches,
        products,
        page: page + 1,
        empty: products.length === 0,
        reachedEnd:
          products.length >= result.total || result.items.length < pageSize,
      })
    } catch (error) {
      this.setData({
        error: error instanceof Error ? error.message : '搜索失败，请重试',
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  onOpenProduct(event: WechatMiniprogram.TouchEvent) {
    wx.navigateTo({
      url: `/pages/product/index?id=${Number(event.currentTarget.dataset.id)}`,
    })
  },

  onImageError() {
    this.setData({ imageFailed: true })
  },

  onOpenFilter() {
    this.setData({ filterOpen: true })
  },

  onCloseFilter() {
    this.setData({ filterOpen: false })
  },

  onSelectPrice(event: WechatMiniprogram.TouchEvent) {
    this.setData({ selectedPrice: String(event.currentTarget.dataset.value) })
  },

  onApplyFilter() {
    this.setData({ filterOpen: false })
    wx.showToast({ title: '筛选条件已应用', icon: 'success' })
  },

  noop() {},
})
