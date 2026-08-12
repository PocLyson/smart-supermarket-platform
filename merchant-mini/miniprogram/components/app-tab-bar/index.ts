import { NAV_ITEMS, type MerchantTab } from './navigation'
import { merchantUnreadStore } from '../../store/message-unread'

const unreadSubscriptions = new WeakMap<object, () => void>()

Component({
  properties: {
    value: {
      type: String,
      value: 'workbench',
    },
  },

  data: {
    items: NAV_ITEMS,
    unreadCount: 0,
  },

  lifetimes: {
    attached() {
      const unsubscribe = merchantUnreadStore.subscribe((unreadCount) => {
        this.setData({ unreadCount })
      })
      unreadSubscriptions.set(this, unsubscribe)
    },
    detached() {
      unreadSubscriptions.get(this)?.()
      unreadSubscriptions.delete(this)
    },
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
