import type { MerchantDashboardSummary } from '../types/dashboard'

export interface MerchantUnreadStore {
  current(): number
  set(count: number): void
  reset(): void
  subscribe(listener: (count: number) => void): () => void
}

const normalizeCount = (count: number): number =>
  Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0

export const createMerchantUnreadStore = (): MerchantUnreadStore => {
  let count = 0
  const listeners = new Set<(value: number) => void>()

  const set = (nextCount: number): void => {
    const normalized = normalizeCount(nextCount)
    if (normalized === count) return
    count = normalized
    listeners.forEach((listener) => listener(count))
  }

  return {
    current: () => count,
    set,
    reset: () => set(0),
    subscribe: (listener) => {
      listeners.add(listener)
      listener(count)
      return () => listeners.delete(listener)
    },
  }
}

export const merchantUnreadStore = createMerchantUnreadStore()

export const syncDashboardUnread = (
  summary: Pick<MerchantDashboardSummary, 'waitingConversationCount'>,
  store: Pick<MerchantUnreadStore, 'set'> = merchantUnreadStore,
): void => store.set(summary.waitingConversationCount)

export const syncConversationListUnread = (
  conversations: ReadonlyArray<{ unreadCount: number }>,
  store: Pick<MerchantUnreadStore, 'set'> = merchantUnreadStore,
): void => store.set(conversations.filter(({ unreadCount }) => unreadCount > 0).length)
