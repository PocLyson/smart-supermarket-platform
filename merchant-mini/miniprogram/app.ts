import { merchantOrderReminderLifecycle } from './utils/order-reminder'

App({
  onShow() {
    return merchantOrderReminderLifecycle.foreground().catch(() => undefined)
  },
  onHide() {
    merchantOrderReminderLifecycle.background()
  },
})
