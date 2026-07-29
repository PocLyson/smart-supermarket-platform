import type { Cart } from './cart'
import { cart } from './cart'
import { PENDING_CHECKOUT_STORAGE_KEY } from './checkout'

export const RECENT_SEARCHES_STORAGE_KEY =
  'smart-store-recent-searches-v1'

interface LocalUsageDataDependencies {
  cart: Pick<Cart, 'clear'>
  removeStorage(key: string): void
}

export const createLocalUsageDataCleaner =
  (dependencies: LocalUsageDataDependencies) => (): void => {
    dependencies.cart.clear()
    dependencies.removeStorage(RECENT_SEARCHES_STORAGE_KEY)
    dependencies.removeStorage(PENDING_CHECKOUT_STORAGE_KEY)
  }

export const clearLocalUsageData = createLocalUsageDataCleaner({
  cart,
  removeStorage: (key) => wx.removeStorageSync(key),
})
