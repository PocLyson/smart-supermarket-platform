import {
  resolveTabNavigation,
  type PrimaryTab,
} from './navigation'

Component({
  properties: {
    value: {
      type: String,
      value: 'home',
    },
  },

  methods: {
    onTabTap(event: WechatMiniprogram.TouchEvent) {
      const next = event.currentTarget.dataset.value as PrimaryTab
      const navigation = resolveTabNavigation(
        this.properties.value as PrimaryTab,
        next,
      )
      if (navigation.method === 'none') return
      wx[navigation.method]({ url: navigation.url })
    },
  },
})
