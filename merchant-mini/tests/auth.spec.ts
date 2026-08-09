import { describe, expect, test, vi } from 'vitest'
import { HttpResponseError, createMerchantHttp } from '../miniprogram/services/http'
import { createMerchantAuthService } from '../miniprogram/services/auth'
import {
  MERCHANT_SESSION_STORAGE_KEY,
  createMerchantSessionStore,
  type MerchantSession,
} from '../miniprogram/store/session'

const validSession = (overrides: Partial<MerchantSession> = {}): MerchantSession => ({
  accessToken: 'merchant-token',
  role: 'OWNER',
  staffId: 7,
  username: 'owner',
  expiresAt: Date.now() + 60_000,
  ...overrides,
})

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
  test('adds the current merchant bearer token automatically', async () => {
    const request = vi.fn().mockResolvedValue({ ok: true })
    const client = createMerchantHttp({
      request,
      session: { current: () => validSession(), save: vi.fn(), clear: vi.fn() },
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
      session: { current: () => validSession(), save: vi.fn(), clear: vi.fn() },
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

  test('a public authentication 401 stays on the form even if stale storage exists', async () => {
    const onUnauthorized = vi.fn()
    const client = createMerchantHttp({
      request: vi.fn().mockResolvedValue({
        statusCode: 401,
        data: { code: 'INVALID_CREDENTIALS', message: '账号或密码错误', requestId: 'req-5', data: null },
      }),
      session: { current: () => validSession(), save: vi.fn(), clear: vi.fn() },
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
      client: { post },
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
      client: { post: vi.fn().mockResolvedValue({ ...validSession(), expiresAt }) },
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
      client: { post: vi.fn().mockRejectedValue(error) },
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
      client: { post },
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
      client: { post },
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
      client: { post: vi.fn().mockRejectedValue(new Error('网络中断')) },
      session: { current: vi.fn(), save: vi.fn(), clear },
      login: vi.fn(),
    })

    await expect(service.logout()).rejects.toThrow('网络中断')
    expect(clear).toHaveBeenCalledOnce()
  })
})
