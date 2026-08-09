import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  createOrderReminder,
  findNewOrderIds,
} from '../miniprogram/utils/order-reminder'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('new order reminder', () => {
  test('finds only identifiers that were not already seen', () => {
    expect(findNewOrderIds(['A', 'B'], new Set(['A']))).toEqual(['B'])
  })

  test('uses the first refresh as a baseline and never repeats a sound for the same order', async () => {
    const fetchSummary = vi.fn()
      .mockResolvedValueOnce(['A'])
      .mockResolvedValueOnce(['A', 'B'])
      .mockResolvedValueOnce(['A', 'B'])
    const onNewOrder = vi.fn()
    const reminder = createOrderReminder({ pollMs: 15_000, fetchSummary, onNewOrder })

    await reminder.refreshNow()
    await reminder.refreshNow()
    await reminder.refreshNow()

    expect(onNewOrder).toHaveBeenCalledOnce()
    expect(onNewOrder).toHaveBeenCalledWith(['B'])
  })

  test('polls only between start and stop', async () => {
    vi.useFakeTimers()
    const fetchSummary = vi.fn().mockResolvedValue([])
    const reminder = createOrderReminder({
      pollMs: 15_000,
      fetchSummary,
      onNewOrder: vi.fn(),
    })

    reminder.start()
    await vi.advanceTimersByTimeAsync(30_000)
    reminder.stop()
    await vi.advanceTimersByTimeAsync(30_000)

    expect(fetchSummary).toHaveBeenCalledTimes(2)
  })

  test('refreshes immediately on foreground and stops polling on background', async () => {
    vi.resetModules()
    const reminderModule = await import('../miniprogram/utils/order-reminder')
    const start = vi.spyOn(reminderModule.merchantOrderReminder, 'start').mockImplementation(() => undefined)
    const refreshNow = vi.spyOn(reminderModule.merchantOrderReminder, 'refreshNow')
      .mockRejectedValue(new Error('network unavailable'))
    const stop = vi.spyOn(reminderModule.merchantOrderReminder, 'stop').mockImplementation(() => undefined)
    const registerApp = vi.fn()
    vi.stubGlobal('App', registerApp)

    await import('../miniprogram/app')
    const lifecycle = registerApp.mock.calls[0][0] as {
      onShow(): Promise<void>
      onHide(): void
    }
    await expect(lifecycle.onShow()).resolves.toBeUndefined()
    lifecycle.onHide()

    expect(start).toHaveBeenCalledOnce()
    expect(refreshNow).toHaveBeenCalledOnce()
    expect(stop).toHaveBeenCalledOnce()
  })
})
