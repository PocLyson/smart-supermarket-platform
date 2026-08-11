import { afterEach, describe, expect, test, vi } from 'vitest'
import { HttpResponseError, createMerchantHttp } from '../miniprogram/services/http'
import { createMerchantAuthService } from '../miniprogram/services/auth'
import {
  MERCHANT_SESSION_STORAGE_KEY,
  createMerchantSessionStore,
  type MerchantSession,
} from '../miniprogram/store/session'
import {
  createMerchantOrderReminderLifecycle,
  createOrderReminder,
} from '../miniprogram/utils/order-reminder'

afterEach(() => {
  vi.useRealTimers()
})

const validSession = (overrides: Partial<MerchantSession> = {}): MerchantSession => ({
  accessToken: 'merchant-token',
  role: 'OWNER',
  staffId: 7,
  username: 'owner',
  expiresAt: Date.now() + 60_000,
  ...overrides,
})

const deferred = <T>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve
  })
  return { promise, resolve }
}

describe('merchant session store', () => {
  test('rejects an expired session so stale credentials cannot be reused', () => {
    const clear = vi.fn()
    const store = createMerchantSessionStore({
      read: () => validSession({ expiresAt: Date.now() - 1 }),
      write: vi.fn(),
      clear,
    })

    expect(store.current()).toBeUndefined()
    expect(clear).toHaveBeenCalledOnce()
  })

  test('rejects a session with an unsupported merchant role', () => {
    const store = createMerchantSessionStore({
      read: () => validSession({ role: 'ADMIN' as MerchantSession['role'] }),
      write: vi.fn(),
      clear: vi.fn(),
    })

    expect(store.current()).toBeUndefined()
  })
})

describe('merchant HTTP boundary', () => {
  test('omits undefined GET query values before handing them to WeChat transport', async () => {
    const request = vi.fn().mockResolvedValue({ ok: true })
    const client = createMerchantHttp({
      request,
      session: { current: () => validSession(), save: vi.fn(), clear: vi.fn(), revision: () => 0 },
    })

    await client.get('/api/merchant-mini/orders', {
      status: undefined,
      paymentStatus: undefined,
      keyword: undefined,
      page: 0,
      size: 20,
    })

    const [options] = request.mock.calls[0]
    expect(options.method).toBe('GET')
    expect(options.data).toStrictEqual({ page: 0, size: 20 })
  })

  test('adds the current merchant bearer token automatically', async () => {
    const request = vi.fn().mockResolvedValue({ ok: true })
    const client = createMerchantHttp({
      request,
      session: { current: () => validSession(), save: vi.fn(), clear: vi.fn(), revision: () => 0 },
    })

    await client.get('/api/merchant-mini/account')

    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      header: { Authorization: 'Bearer merchant-token' },
    }))
  })

  test('a 401 clears only merchant storage and leaves customer storage intact', async () => {
    const storage = new Map<string, unknown>([
      [MERCHANT_SESSION_STORAGE_KEY, validSession()],
      ['smart-store-session-v1', { accessToken: 'customer-token' }],
    ])
    const merchantSession = createMerchantSessionStore({
      read: () => storage.get(MERCHANT_SESSION_STORAGE_KEY),
      write: (session) => storage.set(MERCHANT_SESSION_STORAGE_KEY, session),
      clear: () => storage.delete(MERCHANT_SESSION_STORAGE_KEY),
    })
    const client = createMerchantHttp({
      request: vi.fn().mockResolvedValue({
        statusCode: 401,
        data: { code: 'UNAUTHORIZED', message: '登录已失效', requestId: 'req-1', data: null },
      }),
      session: merchantSession,
    })

    await expect(client.get('/api/merchant-mini/account')).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    })
    expect(storage.has(MERCHANT_SESSION_STORAGE_KEY)).toBe(false)
    expect(storage.get('smart-store-session-v1')).toEqual({ accessToken: 'customer-token' })
  })

  test('a protected 401 leaves the employee screen after clearing its session', async () => {
    const onUnauthorized = vi.fn()
    const client = createMerchantHttp({
      request: vi.fn().mockResolvedValue({
        statusCode: 401,
        data: { code: 'UNAUTHORIZED', message: '登录已失效', requestId: 'req-3', data: null },
      }),
      session: { current: () => validSession(), save: vi.fn(), clear: vi.fn(), revision: () => 0 },
      onUnauthorized,
    })

    await expect(client.get('/api/merchant-mini/account')).rejects.toBeInstanceOf(HttpResponseError)
    expect(onUnauthorized).toHaveBeenCalledOnce()
  })

  test('an expired protected request still leaves the employee screen on 401', async () => {
    const onUnauthorized = vi.fn()
    const expiredStore = createMerchantSessionStore({
      read: () => validSession({ expiresAt: Date.now() - 1 }),
      write: vi.fn(),
      clear: vi.fn(),
    })
    const client = createMerchantHttp({
      request: vi.fn().mockResolvedValue({
        statusCode: 401,
        data: { code: 'UNAUTHORIZED', message: '登录已失效', requestId: 'req-4', data: null },
      }),
      session: expiredStore,
      onUnauthorized,
    })

    await expect(client.get('/api/merchant-mini/account')).rejects.toBeInstanceOf(HttpResponseError)
    expect(onUnauthorized).toHaveBeenCalledOnce()
  })

  test('a protected request that expires while awaiting its 401 still leaves the employee screen', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-09T06:00:00Z'))
    let stored: MerchantSession | undefined = validSession({
      accessToken: 'expiring-token',
      expiresAt: Date.now() + 1_000,
    })
    const session = createMerchantSessionStore({
      read: () => stored,
      write: (value) => { stored = value },
      clear: () => { stored = undefined },
    })
    const response = deferred<unknown>()
    const onUnauthorized = vi.fn()
    const client = createMerchantHttp({
      request: vi.fn().mockReturnValue(response.promise),
      session,
      onUnauthorized,
    })

    const pending = client.get('/api/merchant-mini/account')
    vi.advanceTimersByTime(1_001)
    response.resolve({
      statusCode: 401,
      data: { code: 'UNAUTHORIZED', message: '登录已失效', requestId: 'req-expired-in-flight', data: null },
    })

    await expect(pending).rejects.toBeInstanceOf(HttpResponseError)
    expect(session.current()).toBeUndefined()
    expect(onUnauthorized).toHaveBeenCalledOnce()
  })

  test('concurrent 401 responses for the same expired token trigger one redirect', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-09T06:00:00Z'))
    let stored: MerchantSession | undefined = validSession({
      accessToken: 'shared-expiring-token',
      expiresAt: Date.now() + 1_000,
    })
    const session = createMerchantSessionStore({
      read: () => stored,
      write: (value) => { stored = value },
      clear: () => { stored = undefined },
    })
    const firstResponse = deferred<unknown>()
    const secondResponse = deferred<unknown>()
    const onUnauthorized = vi.fn()
    const client = createMerchantHttp({
      request: vi.fn()
        .mockReturnValueOnce(firstResponse.promise)
        .mockReturnValueOnce(secondResponse.promise),
      session,
      onUnauthorized,
    })

    const firstPending = client.get('/api/merchant-mini/account')
    const secondPending = client.get('/api/merchant-mini/dashboard/summary')
    vi.advanceTimersByTime(1_001)
    const unauthorized = {
      statusCode: 401,
      data: { code: 'UNAUTHORIZED', message: '登录已失效', requestId: 'req-concurrent', data: null },
    }
    firstResponse.resolve(unauthorized)
    secondResponse.resolve(unauthorized)

    await expect(firstPending).rejects.toBeInstanceOf(HttpResponseError)
    await expect(secondPending).rejects.toBeInstanceOf(HttpResponseError)
    expect(onUnauthorized).toHaveBeenCalledOnce()
  })

  test('a handled 401 does not block unauthorized handling for a later session token', async () => {
    let stored: MerchantSession | undefined = validSession({ accessToken: 'first-token' })
    const session = createMerchantSessionStore({
      read: () => stored,
      write: (value) => { stored = value },
      clear: () => { stored = undefined },
    })
    const onUnauthorized = vi.fn()
    const client = createMerchantHttp({
      request: vi.fn().mockResolvedValue({
        statusCode: 401,
        data: { code: 'UNAUTHORIZED', message: '登录已失效', requestId: 'req-session', data: null },
      }),
      session,
      onUnauthorized,
    })

    await expect(client.get('/api/merchant-mini/account')).rejects.toBeInstanceOf(HttpResponseError)
    session.save(validSession({ accessToken: 'second-token' }))
    await expect(client.get('/api/merchant-mini/account')).rejects.toBeInstanceOf(HttpResponseError)

    expect(onUnauthorized).toHaveBeenCalledTimes(2)
  })

  test('a late 401 cannot clear a newer session that reuses the same token value', async () => {
    let stored: MerchantSession | undefined = validSession({
      accessToken: 'reused-token',
      staffId: 1,
    })
    const session = createMerchantSessionStore({
      read: () => stored,
      write: (value) => { stored = value },
      clear: () => { stored = undefined },
    })
    const firstOldResponse = deferred<unknown>()
    const secondOldResponse = deferred<unknown>()
    const newResponse = deferred<unknown>()
    const onUnauthorized = vi.fn()
    const client = createMerchantHttp({
      request: vi.fn()
        .mockReturnValueOnce(firstOldResponse.promise)
        .mockReturnValueOnce(secondOldResponse.promise)
        .mockReturnValueOnce(newResponse.promise),
      session,
      onUnauthorized,
    })
    const unauthorized = (requestId: string) => ({
      statusCode: 401,
      data: { code: 'UNAUTHORIZED', message: '登录已失效', requestId, data: null },
    })

    const firstOldPending = client.get('/api/merchant-mini/account')
    const secondOldPending = client.get('/api/merchant-mini/dashboard/summary')
    firstOldResponse.resolve(unauthorized('req-old-first'))
    await expect(firstOldPending).rejects.toBeInstanceOf(HttpResponseError)
    expect(onUnauthorized).toHaveBeenCalledOnce()

    session.save(validSession({ accessToken: 'reused-token', staffId: 2 }))
    const newPending = client.get('/api/merchant-mini/account')
    secondOldResponse.resolve(unauthorized('req-old-late'))
    await expect(secondOldPending).rejects.toBeInstanceOf(HttpResponseError)

    expect(session.current()?.staffId).toBe(2)
    expect(onUnauthorized).toHaveBeenCalledOnce()

    newResponse.resolve(unauthorized('req-new-session'))
    await expect(newPending).rejects.toBeInstanceOf(HttpResponseError)
    expect(session.current()).toBeUndefined()
    expect(onUnauthorized).toHaveBeenCalledTimes(2)
  })

  test('a late 401 from an old token cannot clear or redirect a newly authenticated session', async () => {
    let stored: MerchantSession | undefined = validSession({ accessToken: 'old-token' })
    const session = createMerchantSessionStore({
      read: () => stored,
      write: (value) => { stored = value },
      clear: () => { stored = undefined },
    })
    const response = deferred<unknown>()
    const onUnauthorized = vi.fn()
    const client = createMerchantHttp({
      request: vi.fn().mockReturnValue(response.promise),
      session,
      onUnauthorized,
    })

    const pending = client.get('/api/merchant-mini/account')
    session.save(validSession({ accessToken: 'new-token', staffId: 8 }))
    response.resolve({
      statusCode: 401,
      data: { code: 'UNAUTHORIZED', message: '登录已失效', requestId: 'req-stale', data: null },
    })

    await expect(pending).rejects.toBeInstanceOf(HttpResponseError)
    expect(session.current()?.accessToken).toBe('new-token')
    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  test('a late tokenless 401 cannot clear a session created after the request started', async () => {
    let stored: MerchantSession | undefined
    const session = createMerchantSessionStore({
      read: () => stored,
      write: (value) => { stored = value },
      clear: () => { stored = undefined },
    })
    const response = deferred<unknown>()
    const onUnauthorized = vi.fn()
    const client = createMerchantHttp({
      request: vi.fn().mockReturnValue(response.promise),
      session,
      onUnauthorized,
    })

    const pending = client.get('/api/merchant-mini/account')
    session.save(validSession({ accessToken: 'new-token' }))
    response.resolve({
      statusCode: 401,
      data: { code: 'UNAUTHORIZED', message: '登录已失效', requestId: 'req-tokenless', data: null },
    })

    await expect(pending).rejects.toBeInstanceOf(HttpResponseError)
    expect(session.current()?.accessToken).toBe('new-token')
    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  test('a public authentication 401 stays on the form even if stale storage exists', async () => {
    const onUnauthorized = vi.fn()
    const client = createMerchantHttp({
      request: vi.fn().mockResolvedValue({
        statusCode: 401,
        data: { code: 'INVALID_CREDENTIALS', message: '账号或密码错误', requestId: 'req-5', data: null },
      }),
      session: { current: () => validSession(), save: vi.fn(), clear: vi.fn(), revision: () => 0 },
      onUnauthorized,
    })

    await expect(
      client.post(
        '/api/merchant-mini/auth/password-login',
        { username: 'owner' },
        { authorization: 'public' },
      ),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })
    expect(onUnauthorized).not.toHaveBeenCalled()
  })
})

describe('merchant login flow', () => {
  test('resumes a valid stored session without another WeChat login', async () => {
    const post = vi.fn()
    const login = vi.fn()
    const existing = validSession()
    const service = createMerchantAuthService({
      client: { post, delete: vi.fn() },
      session: { current: () => existing, save: vi.fn(), clear: vi.fn() },
      login,
    })

    await expect(service.resumeOrLogin()).resolves.toEqual(existing)
    expect(login).not.toHaveBeenCalled()
    expect(post).not.toHaveBeenCalled()
  })

  test('normalizes the API ISO expiry into the local millisecond session contract', async () => {
    const expiresAt = '2026-08-09T12:00:00Z'
    const save = vi.fn()
    const service = createMerchantAuthService({
      client: { post: vi.fn().mockResolvedValue({ ...validSession(), expiresAt }), delete: vi.fn() },
      session: { current: vi.fn(), save, clear: vi.fn() },
      login: vi.fn().mockResolvedValue({ code: 'wx-code' }),
    })

    const session = await service.loginWithWechat()

    expect(session.expiresAt).toBe(Date.parse(expiresAt))
    expect(save).toHaveBeenCalledWith(session)
  })

  test('reveals the binding flow only for MERCHANT_NOT_BOUND', async () => {
    const error = new HttpResponseError('该微信尚未绑定员工账号', 404, 'MERCHANT_NOT_BOUND', 'req-2')
    const service = createMerchantAuthService({
      client: { post: vi.fn().mockRejectedValue(error), delete: vi.fn() },
      session: { current: vi.fn(), save: vi.fn(), clear: vi.fn() },
      login: vi.fn().mockResolvedValue({ code: 'wx-code' }),
    })

    await expect(service.loginWithWechat()).rejects.toMatchObject({
      code: 'MERCHANT_NOT_BOUND',
    })
    expect(service.requiresPasswordBinding(error)).toBe(true)
    expect(service.requiresPasswordBinding(new Error('网络错误'))).toBe(false)
  })

  test('does not send credentials until password binding is explicitly confirmed', async () => {
    const post = vi.fn()
    const login = vi.fn()
    const service = createMerchantAuthService({
      client: { post, delete: vi.fn() },
      session: { current: vi.fn(), save: vi.fn(), clear: vi.fn() },
      login,
    })

    await expect(service.loginWithPassword('owner', 'secret', false)).rejects.toThrow('请确认绑定当前微信')
    expect(login).not.toHaveBeenCalled()
    expect(post).not.toHaveBeenCalled()
  })

  test('confirmed password login exchanges a fresh code and saves the merchant session', async () => {
    const save = vi.fn()
    const post = vi.fn().mockResolvedValue(validSession())
    const service = createMerchantAuthService({
      client: { post, delete: vi.fn() },
      session: { current: vi.fn(), save, clear: vi.fn() },
      login: vi.fn().mockResolvedValue({ code: 'fresh-code' }),
    })

    const session = await service.loginWithPassword('owner', 'secret', true)

    expect(post).toHaveBeenCalledWith('/api/merchant-mini/auth/password-login', {
      username: 'owner',
      password: 'secret',
      code: 'fresh-code',
    }, { authorization: 'public' })
    expect(save).toHaveBeenCalledWith(session)
  })

  test('logout clears the local merchant session even when the network request fails', async () => {
    const clear = vi.fn()
    const service = createMerchantAuthService({
      client: { post: vi.fn().mockRejectedValue(new Error('网络中断')), delete: vi.fn() },
      session: { current: vi.fn(), save: vi.fn(), clear },
      login: vi.fn(),
    })

    await expect(service.logout()).rejects.toThrow('网络中断')
    expect(clear).toHaveBeenCalledOnce()
  })

  test.each(['OWNER', 'CASHIER'] as const)(
    'unbinds the current %s WeChat through the real endpoint and clears only merchant session state after success',
    async (role) => {
      const storage = new Map<string, unknown>([
        [MERCHANT_SESSION_STORAGE_KEY, validSession({ role })],
        ['smart-store-session-v1', { accessToken: 'customer-token' }],
      ])
      const session = createMerchantSessionStore({
        read: () => storage.get(MERCHANT_SESSION_STORAGE_KEY),
        write: (value) => storage.set(MERCHANT_SESSION_STORAGE_KEY, value),
        clear: () => storage.delete(MERCHANT_SESSION_STORAGE_KEY),
      })
      const deleteRequest = vi.fn().mockResolvedValue(undefined)
      const signedOut = vi.fn()
      const service = createMerchantAuthService({
        client: { post: vi.fn(), delete: deleteRequest },
        session,
        login: vi.fn(),
        reminderLifecycle: { authenticated: vi.fn(), signedOut },
      })
      await service.unbindWechat()

      expect(deleteRequest).toHaveBeenCalledWith(
        '/api/merchant-mini/account/wechat-binding',
      )
      expect(storage.has(MERCHANT_SESSION_STORAGE_KEY)).toBe(false)
      expect(storage.get('smart-store-session-v1')).toEqual({
        accessToken: 'customer-token',
      })
      expect(signedOut).toHaveBeenCalledOnce()
    },
  )

  test('keeps the merchant session when the unbind endpoint fails', async () => {
    const clear = vi.fn()
    const signedOut = vi.fn()
    const service = createMerchantAuthService({
      client: {
        post: vi.fn(),
        delete: vi.fn().mockRejectedValue(new Error('网络中断')),
      },
      session: { current: vi.fn(), save: vi.fn(), clear },
      login: vi.fn(),
      reminderLifecycle: { authenticated: vi.fn(), signedOut },
    })
    await expect(service.unbindWechat()).rejects.toThrow('网络中断')

    expect(clear).not.toHaveBeenCalled()
    expect(signedOut).not.toHaveBeenCalled()
  })

  test('successful login starts the protected reminder and logout stops it', async () => {
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
    const reminderLifecycle = createMerchantOrderReminderLifecycle(session, reminder)
    const post = vi.fn()
      .mockResolvedValueOnce(validSession())
      .mockResolvedValueOnce(undefined)
    const service = createMerchantAuthService({
      client: { post, delete: vi.fn() },
      session,
      login: vi.fn().mockResolvedValue({ code: 'wx-code' }),
      reminderLifecycle,
    })

    await reminderLifecycle.foreground()
    await service.loginWithWechat()
    expect(fetchSummary).toHaveBeenCalledOnce()

    await service.logout()
    await vi.advanceTimersByTimeAsync(30_000)
    expect(fetchSummary).toHaveBeenCalledOnce()
  })

  test('confirmed password login also starts the protected reminder', async () => {
    let stored: MerchantSession | undefined
    const session = createMerchantSessionStore({
      read: () => stored,
      write: (value) => { stored = value },
      clear: () => { stored = undefined },
    })
    const fetchSummary = vi.fn().mockResolvedValue([])
    const reminder = createOrderReminder({
      hasValidSession: () => Boolean(session.current()),
      fetchSummary,
      onNewOrder: vi.fn(),
    })
    const reminderLifecycle = createMerchantOrderReminderLifecycle(session, reminder)
    const service = createMerchantAuthService({
      client: { post: vi.fn().mockResolvedValue(validSession()), delete: vi.fn() },
      session,
      login: vi.fn().mockResolvedValue({ code: 'wx-code' }),
      reminderLifecycle,
    })

    await reminderLifecycle.foreground()
    await service.loginWithPassword('owner', 'secret', true)

    expect(fetchSummary).toHaveBeenCalledOnce()
    reminderLifecycle.signedOut()
  })

  test('a login that resolves after the app is hidden waits for the next foreground to poll', async () => {
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
    const reminderLifecycle = createMerchantOrderReminderLifecycle(session, reminder)
    const loginResponse = deferred<MerchantSession>()
    const service = createMerchantAuthService({
      client: { post: vi.fn().mockReturnValue(loginResponse.promise), delete: vi.fn() },
      session,
      login: vi.fn().mockResolvedValue({ code: 'wx-code' }),
      reminderLifecycle,
    })

    await reminderLifecycle.foreground()
    const pendingLogin = service.loginWithWechat()
    reminderLifecycle.background()
    loginResponse.resolve(validSession())
    await pendingLogin
    await vi.advanceTimersByTimeAsync(30_000)

    expect(fetchSummary).not.toHaveBeenCalled()

    await reminderLifecycle.foreground()
    expect(fetchSummary).toHaveBeenCalledOnce()
    reminderLifecycle.signedOut()
  })
})
