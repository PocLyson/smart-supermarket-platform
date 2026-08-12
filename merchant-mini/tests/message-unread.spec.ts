import { describe, expect, test, vi } from 'vitest'
import type { MerchantDashboardSummary } from '../miniprogram/types/dashboard'
import {
  createMerchantUnreadStore,
  syncConversationListUnread,
  syncDashboardUnread,
} from '../miniprogram/store/message-unread'

const dashboard = (waitingConversationCount: number): MerchantDashboardSummary => ({
  orderCounts: {
    PENDING_CONFIRMATION: 0,
    PREPARING: 0,
    READY_FOR_PICKUP: 0,
    COMPLETED: 0,
    CANCELLED: 0,
  },
  lowStockCount: 0,
  waitingConversationCount,
  latestOrders: [],
})

describe('merchant unread conversation store', () => {
  test('publishes normalized changes immediately and stops after unsubscribe', () => {
    const store = createMerchantUnreadStore()
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)

    store.set(3)
    store.set(3)
    store.set(-2)
    unsubscribe()
    store.set(7)

    expect(listener.mock.calls.map(([count]) => count)).toEqual([0, 3, 0])
    expect(store.current()).toBe(7)
  })

  test('syncs the dashboard waiting-conversation count into the shared badge state', () => {
    const store = createMerchantUnreadStore()

    syncDashboardUnread(dashboard(4), store)

    expect(store.current()).toBe(4)
  })

  test('counts only conversations that still need a merchant reply', () => {
    const store = createMerchantUnreadStore()

    syncConversationListUnread([
      { unreadCount: 2 },
      { unreadCount: 0 },
      { unreadCount: 1 },
    ], store)

    expect(store.current()).toBe(2)
  })
})
