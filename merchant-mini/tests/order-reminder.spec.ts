import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  createMerchantOrderReminderLifecycle,
  createOrderReminder,
  findNewOrderIds,
} from '../miniprogram/utils/order-reminder'
import {
  createMerchantSessionStore,
  type MerchantSession,
} from '../miniprogram/store/session'

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

    reminder.start()
    await reminder.refreshNow()
    await reminder.refreshNow()
    await reminder.refreshNow()

    expect(onNewOrder).toHaveBeenCalledOnce()
    expect(onNewOrder).toHaveBeenCalledWith(['B'])
  })

  test('invalidates an in-flight foreground refresh when the app is hidden', async () => {
    let resolveHiddenRefresh: (orderIds: readonly string[]) => void = () => undefined
    const hiddenRefresh = new Promise<readonly string[]>((resolve) => {
      resolveHiddenRefresh = resolve
    })
    const fetchSummary = vi.fn()
      .mockResolvedValueOnce(['A'])
      .mockReturnValueOnce(hiddenRefresh)
      .mockResolvedValueOnce(['A', 'B'])
    const onNewOrder = vi.fn()
    const reminder = createOrderReminder({ fetchSummary, onNewOrder })

    reminder.start()
    await reminder.refreshNow()
    const pending = reminder.refreshNow()
    reminder.stop()
    resolveHiddenRefresh(['A', 'B'])
    await pending

    expect(onNewOrder).not.toHaveBeenCalled()

    reminder.start()
    await reminder.refreshNow()
    expect(onNewOrder).toHaveBeenCalledOnce()
    expect(onNewOrder).toHaveBeenCalledWith(['B'])
  })

  test('a real session lifecycle never fetches while signed out and resumes after authentication', async () => {
    vi.useFakeTimers()
    let stored: MerchantSession | undefined
    const session = createMerchantSessionStore({
      read: () => stored,
      write: (value) => { stored = value },
      clear: () => { stored = undefined },
    })
    const fetchSummary = vi.fn().mockResolvedValue([])
    const reminder = createOrderReminder({
      pollMs: 15_000,
      hasValidSession: () => Boolean(session.current()),
      fetchSummary,
      onNewOrder: vi.fn(),
    })
    const lifecycle = createMerchantOrderReminderLifecycle(session, reminder)

    await lifecycle.foreground()
    await vi.advanceTimersByTimeAsync(30_000)
    expect(fetchSummary).not.toHaveBeenCalled()

    session.save({
      accessToken: 'merchant-token',
      role: 'CASHIER',
      staffId: 9,
      username: 'cashier',
      expiresAt: Date.now() + 60_000,
    })
    await lifecycle.authenticated()
    expect(fetchSummary).toHaveBeenCalledOnce()

    lifecycle.signedOut()
    await vi.advanceTimersByTimeAsync(30_000)
    expect(fetchSummary).toHaveBeenCalledOnce()
  })

  test('signing out clears the previous account baseline before the next login', async () => {
    vi.useFakeTimers()
    let stored: MerchantSession | undefined = {
      accessToken: 'first-token',
      role: 'OWNER',
      staffId: 1,
      username: 'first-owner',
      expiresAt: Date.now() + 60_000,
    }
    const session = createMerchantSessionStore({
      read: () => stored,
      write: (value) => { stored = value },
      clear: () => { stored = undefined },
    })
    const fetchSummary = vi.fn()
      .mockResolvedValueOnce(['A'])
      .mockResolvedValueOnce(['A', 'B'])
      .mockResolvedValueOnce(['A', 'B', 'C'])
    const onNewOrder = vi.fn()
    const reminder = createOrderReminder({
      hasValidSession: () => Boolean(session.current()),
      fetchSummary,
      onNewOrder,
    })
    const lifecycle = createMerchantOrderReminderLifecycle(session, reminder)

    await lifecycle.foreground()
    await reminder.refreshNow()
    expect(onNewOrder).toHaveBeenCalledWith(['B'])

    session.clear()
    lifecycle.signedOut()
    session.save({
      accessToken: 'second-token',
      role: 'CASHIER',
      staffId: 2,
      username: 'second-cashier',
      expiresAt: Date.now() + 60_000,
    })
    await lifecycle.authenticated()

    expect(onNewOrder).toHaveBeenCalledTimes(1)
    lifecycle.signedOut()
  })

  test('stops itself before a protected fetch when the stored session becomes invalid', async () => {
    vi.useFakeTimers()
    let valid = true
    const fetchSummary = vi.fn().mockResolvedValue([])
    const reminder = createOrderReminder({
      pollMs: 15_000,
      hasValidSession: () => valid,
      fetchSummary,
      onNewOrder: vi.fn(),
    })

    reminder.start()
    await reminder.refreshNow()
    valid = false
    await vi.advanceTimersByTimeAsync(30_000)

    expect(fetchSummary).toHaveBeenCalledOnce()
  })

  test('resets immediately when a protected refresh clears the session', async () => {
    let valid = true
    const fetchSummary = vi.fn()
      .mockResolvedValueOnce(['A'])
      .mockImplementationOnce(async () => {
        valid = false
        throw new Error('401 unauthorized')
      })
      .mockResolvedValueOnce(['A', 'B'])
    const onNewOrder = vi.fn()
    const reminder = createOrderReminder({
      hasValidSession: () => valid,
      fetchSummary,
      onNewOrder,
    })

    reminder.start()
    await reminder.refreshNow()
    await expect(reminder.refreshNow()).rejects.toThrow('401 unauthorized')
    valid = true
    reminder.start()
    await reminder.refreshNow()

    expect(onNewOrder).not.toHaveBeenCalled()
    reminder.reset()
  })

  test('authentication starts a fresh baseline even when an old session was still active', async () => {
    let stored: MerchantSession | undefined = {
      accessToken: 'old-token',
      role: 'OWNER',
      staffId: 1,
      username: 'old-owner',
      expiresAt: Date.now() + 60_000,
    }
    const session = createMerchantSessionStore({
      read: () => stored,
      write: (value) => { stored = value },
      clear: () => { stored = undefined },
    })
    const fetchSummary = vi.fn()
      .mockResolvedValueOnce(['A'])
      .mockResolvedValueOnce(['A', 'B'])
    const onNewOrder = vi.fn()
    const reminder = createOrderReminder({
      hasValidSession: () => Boolean(session.current()),
      fetchSummary,
      onNewOrder,
    })
    const lifecycle = createMerchantOrderReminderLifecycle(session, reminder)

    await lifecycle.foreground()
    session.save({
      accessToken: 'new-token',
      role: 'CASHIER',
      staffId: 2,
      username: 'new-cashier',
      expiresAt: Date.now() + 60_000,
    })
    await lifecycle.authenticated()

    expect(onNewOrder).not.toHaveBeenCalled()
    lifecycle.signedOut()
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

  test('delegates app foreground and background to the session-aware lifecycle', async () => {
    vi.resetModules()
    const reminderModule = await import('../miniprogram/utils/order-reminder')
    const foreground = vi.spyOn(reminderModule.merchantOrderReminderLifecycle, 'foreground')
      .mockRejectedValue(new Error('network unavailable'))
    const background = vi.spyOn(reminderModule.merchantOrderReminderLifecycle, 'background')
      .mockImplementation(() => undefined)
    const registerApp = vi.fn()
    vi.stubGlobal('App', registerApp)

    await import('../miniprogram/app')
    const lifecycle = registerApp.mock.calls[0][0] as {
      onShow(): Promise<void>
      onHide(): void
    }
    await expect(lifecycle.onShow()).resolves.toBeUndefined()
    lifecycle.onHide()

    expect(foreground).toHaveBeenCalledOnce()
    expect(background).toHaveBeenCalledOnce()
  })
})
