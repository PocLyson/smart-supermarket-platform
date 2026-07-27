import { cart } from '../../store/cart'

Page({
  data: {
    items: cart.items(),
    totalCent: cart.selectedTotalCent(),
  },

  onShow() {
    this.refresh()
  },

  refresh() {
    this.setData({
      items: cart.items(),
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
    cart.remove([Number(event.currentTarget.dataset.id)])
    this.refresh()
  },

  onCheckout() {
    if (cart.selectedItems().length === 0) {
      wx.showToast({ title: '请先选择商品', icon: 'none' })
      return
    }
    wx.navigateTo({ url: '/pages/checkout/index' })
  },
})
