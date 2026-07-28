import { cart } from '../../store/cart'
import { formatMoney } from '../../utils/money'

const presentCart = () => {
  const items = cart.items()
  return {
    items: items.map((item) => ({
      ...item,
      displayPrice: formatMoney(item.unitPriceCent),
    })),
    selectedCount: items.filter((item) => item.selected).length,
    displayTotal: formatMoney(cart.selectedTotalCent()),
  }
}

Page({
  data: {
    ...presentCart(),
    totalCent: cart.selectedTotalCent(),
    imageFailed: false,
    fallbackImage: '/assets/icons/image-placeholder.svg',
  },

  onShow() {
    this.refresh()
  },

  refresh() {
    this.setData({
      ...presentCart(),
      totalCent: cart.selectedTotalCent(),
    })
  },

  onToggle(event: WechatMiniprogram.CheckboxGroupChange) {
    const selectedIds = new Set(event.detail.value.map(Number))
    for (const item of cart.items()) {
      cart.setSelected(item.productId, selectedIds.has(item.productId))
    }
    this.refresh()
  },

  onDecrease(event: WechatMiniprogram.TouchEvent) {
    const productId = Number(event.currentTarget.dataset.id)
    const item = cart.items().find((candidate) => candidate.productId === productId)
    if (!item || item.quantity === 1) return
    cart.setQuantity(productId, item.quantity - 1)
    this.refresh()
  },

  onIncrease(event: WechatMiniprogram.TouchEvent) {
    const productId = Number(event.currentTarget.dataset.id)
    const item = cart.items().find((candidate) => candidate.productId === productId)
    if (!item) return
    cart.setQuantity(productId, item.quantity + 1)
    this.refresh()
  },

  onRemove(event: WechatMiniprogram.TouchEvent) {
    const productId = Number(event.currentTarget.dataset.id)
    wx.showModal({
      title: '删除这件商品？',
      content: '删除后可以重新加入购物车。',
      confirmText: '确认删除',
      confirmColor: '#E5484D',
      success: ({ confirm }) => {
        if (!confirm) return
        cart.remove([productId])
        this.refresh()
        wx.showToast({ title: '已删除', icon: 'success' })
      },
    })
  },

  onCheckout() {
    if (cart.selectedItems().length === 0) {
      wx.showToast({ title: '请先选择商品', icon: 'none' })
      return
    }
    wx.navigateTo({ url: '/pages/checkout/index' })
  },

  onGoShopping() {
    wx.reLaunch({ url: '/pages/home/index' })
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
