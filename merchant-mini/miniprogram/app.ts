import { merchantOrderReminder } from './utils/order-reminder'

App({
  onShow() {
    merchantOrderReminder.start()
    return merchantOrderReminder.refreshNow().catch(() => undefined)
  },
  onHide() {
    merchantOrderReminder.stop()
  },
})
