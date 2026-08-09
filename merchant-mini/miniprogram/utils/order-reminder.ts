import { merchantDashboardService } from '../services/dashboard'
import {
  merchantSessionStore,
  type MerchantSessionStore,
} from '../store/session'

export interface OrderReminderOptions {
  pollMs?: number
  hasValidSession?: () => boolean
  fetchSummary(): Promise<readonly string[]>
  onNewOrder(orderIds: string[]): void
}

export interface OrderReminder {
  start(): void
  refreshNow(): Promise<void>
  stop(): void
  reset(): void
}

export interface MerchantOrderReminderLifecycle {
  foreground(): Promise<void>
  authenticated(): Promise<void>
  background(): void
  signedOut(): void
}

export const findNewOrderIds = (
  currentOrderIds: readonly string[],
  seenOrderIds: ReadonlySet<string>,
): string[] => currentOrderIds.filter((orderId) => !seenOrderIds.has(orderId))

export const createOrderReminder = ({
  pollMs = 15_000,
  hasValidSession = () => true,
  fetchSummary,
  onNewOrder,
}: OrderReminderOptions): OrderReminder => {
  const seenOrderIds = new Set<string>()
  let hasBaseline = false
  let active = false
  let generation = 0
  let interval: ReturnType<typeof setInterval> | undefined
  let inFlight: { generation: number; promise: Promise<void> } | undefined

  const deactivate = (clearReminderState: boolean): void => {
    active = false
    generation += 1
    if (interval) clearInterval(interval)
    interval = undefined
    if (clearReminderState) {
      seenOrderIds.clear()
      hasBaseline = false
    }
  }

  const refresh = async (refreshGeneration: number): Promise<void> => {
    const orderIds = [...await fetchSummary()]
    if (!active || generation !== refreshGeneration) return
    const newOrderIds = findNewOrderIds(orderIds, seenOrderIds)
    orderIds.forEach((orderId) => seenOrderIds.add(orderId))
    if (hasBaseline && newOrderIds.length > 0) onNewOrder(newOrderIds)
    hasBaseline = true
  }

  const refreshNow = (): Promise<void> => {
    if (!active) return Promise.resolve()
    if (!hasValidSession()) {
      deactivate(true)
      return Promise.resolve()
    }
    const refreshGeneration = generation
    if (inFlight?.generation === refreshGeneration) return inFlight.promise
    const promise = refresh(refreshGeneration)
      .catch((error: unknown) => {
        if (!hasValidSession()) deactivate(true)
        throw error
      })
      .finally(() => {
        if (inFlight?.promise === promise) inFlight = undefined
      })
    inFlight = { generation: refreshGeneration, promise }
    return promise
  }

  return {
    start: () => {
      if (active) return
      if (!hasValidSession()) {
        deactivate(true)
        return
      }
      active = true
      generation += 1
      interval = setInterval(() => {
        void refreshNow().catch(() => undefined)
      }, pollMs)
    },
    refreshNow,
    stop: () => deactivate(false),
    reset: () => deactivate(true),
  }
}

export const createMerchantOrderReminderLifecycle = (
  session: Pick<MerchantSessionStore, 'current'>,
  reminder: OrderReminder,
): MerchantOrderReminderLifecycle => {
  let isForeground = false

  const activate = async (freshBaseline: boolean): Promise<void> => {
    if (freshBaseline) reminder.reset()
    if (!isForeground) return
    if (!session.current()) {
      reminder.reset()
      return
    }
    reminder.start()
    await reminder.refreshNow().catch(() => undefined)
  }

  const foreground = (): Promise<void> => {
    isForeground = true
    return activate(false)
  }

  return {
    foreground,
    authenticated: () => activate(true),
    background: () => {
      isForeground = false
      reminder.stop()
    },
    signedOut: () => reminder.reset(),
  }
}

export const merchantOrderReminder = createOrderReminder({
  pollMs: 15_000,
  hasValidSession: () => Boolean(merchantSessionStore.current()),
  fetchSummary: async () => {
    const summary = await merchantDashboardService.summary()
    return summary.latestOrders
      .filter(({ status }) => status === 'PENDING_CONFIRMATION')
      .map(({ orderNo }) => orderNo)
  },
  onNewOrder: (orderIds) => {
    if (typeof wx === 'undefined') return
    wx.vibrateShort({ type: 'medium' })
    wx.showToast({
      title: orderIds.length > 1 ? `${orderIds.length} 个新订单待接单` : '有新订单待接单',
      icon: 'none',
    })
  },
})

export const merchantOrderReminderLifecycle = createMerchantOrderReminderLifecycle(
  merchantSessionStore,
  merchantOrderReminder,
)
