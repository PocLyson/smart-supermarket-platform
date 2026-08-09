import { merchantDashboardService } from '../services/dashboard'

export interface OrderReminderOptions {
  pollMs?: number
  fetchSummary(): Promise<readonly string[]>
  onNewOrder(orderIds: string[]): void
}

export interface OrderReminder {
  start(): void
  refreshNow(): Promise<void>
  stop(): void
}

export const findNewOrderIds = (
  currentOrderIds: readonly string[],
  seenOrderIds: ReadonlySet<string>,
): string[] => currentOrderIds.filter((orderId) => !seenOrderIds.has(orderId))

export const createOrderReminder = ({
  pollMs = 15_000,
  fetchSummary,
  onNewOrder,
}: OrderReminderOptions): OrderReminder => {
  const seenOrderIds = new Set<string>()
  let hasBaseline = false
  let interval: ReturnType<typeof setInterval> | undefined
  let inFlight: Promise<void> | undefined

  const refresh = async (): Promise<void> => {
    const orderIds = [...await fetchSummary()]
    const newOrderIds = findNewOrderIds(orderIds, seenOrderIds)
    orderIds.forEach((orderId) => seenOrderIds.add(orderId))
    if (hasBaseline && newOrderIds.length > 0) onNewOrder(newOrderIds)
    hasBaseline = true
  }

  const refreshNow = (): Promise<void> => {
    if (inFlight) return inFlight
    inFlight = refresh().finally(() => {
      inFlight = undefined
    })
    return inFlight
  }

  return {
    start: () => {
      if (interval) return
      interval = setInterval(() => {
        void refreshNow().catch(() => undefined)
      }, pollMs)
    },
    refreshNow,
    stop: () => {
      if (!interval) return
      clearInterval(interval)
      interval = undefined
    },
  }
}

export const merchantOrderReminder = createOrderReminder({
  pollMs: 15_000,
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
