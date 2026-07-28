Page({
  data: {
    orderNo: '',
    uncertain: false,
  },

  onLoad(query: Record<string, string | undefined>) {
    this.setData({
      orderNo: query.orderNo ? decodeURIComponent(query.orderNo) : '',
      uncertain: query.uncertain === '1',
    })
  },

  onViewOrder() {
    if (!this.data.orderNo) {
      wx.redirectTo({ url: '/pages/orders/index' })
      return
    }
    wx.redirectTo({
      url: `/pages/order-detail/index?orderNo=${encodeURIComponent(this.data.orderNo)}`,
    })
  },

  onBackHome() {
    wx.reLaunch({ url: '/pages/home/index' })
  },
})
