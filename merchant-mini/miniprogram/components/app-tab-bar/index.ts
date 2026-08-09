import { NAV_ITEMS, type MerchantTab } from './navigation'

Component({
  properties: {
    value: {
      type: String,
      value: 'workbench',
    },
  },

  data: {
    items: NAV_ITEMS,
  },

  methods: {
    onTabTap(event: WechatMiniprogram.TouchEvent) {
      const target = event.currentTarget.dataset.value as MerchantTab
      if (target === this.properties.value) return
      const item = NAV_ITEMS.find(({ id }) => id === target)
      if (item) wx.redirectTo({ url: item.url })
    },
  },
})
