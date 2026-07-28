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
    onChange(event: { detail: { value: PrimaryTab } }) {
      const navigation = resolveTabNavigation(
        this.properties.value as PrimaryTab,
        event.detail.value,
      )
      if (navigation.method === 'none') return
      wx[navigation.method]({ url: navigation.url })
    },
  },
})
