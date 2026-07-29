import { describe, expect, it, vi } from 'vitest'
import {
  createLocalUsageDataCleaner,
  RECENT_SEARCHES_STORAGE_KEY,
} from '../miniprogram/store/local-usage-data'
import { PENDING_CHECKOUT_STORAGE_KEY } from '../miniprogram/store/checkout'
import { SESSION_STORAGE_KEY } from '../miniprogram/store/session'

describe('local usage data cleanup', () => {
  it('clears cart, searches and pending checkout without clearing session', () => {
    const clearCart = vi.fn()
    const removeStorage = vi.fn()
    const clear = createLocalUsageDataCleaner({
      cart: { clear: clearCart },
      removeStorage,
    })

    clear()

    expect(clearCart).toHaveBeenCalledOnce()
    expect(removeStorage).toHaveBeenCalledWith(RECENT_SEARCHES_STORAGE_KEY)
    expect(removeStorage).toHaveBeenCalledWith(PENDING_CHECKOUT_STORAGE_KEY)
    expect(removeStorage).not.toHaveBeenCalledWith(SESSION_STORAGE_KEY)
  })
})
