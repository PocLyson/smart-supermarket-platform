import { afterEach, describe, expect, test, vi } from 'vitest'
import type { MerchantRole, MerchantSession } from '../miniprogram/store/session'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.doUnmock('../miniprogram/services/auth')
})

const sessionForRole = (role: MerchantRole): MerchantSession => ({
  accessToken: 'merchant-token',
  role,
  staffId: role === 'OWNER' ? 7 : 8,
  username: role === 'OWNER' ? 'owner' : 'cashier',
  expiresAt: Date.now() + 60_000,
})

const deferred = <T>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve
  })
  return { promise, resolve }
}

describe('merchant account and WeChat unbind flow', () => {
  test.each(['OWNER', 'CASHIER'] as const)(
    'lets a %s confirm unbinding once, exposes loading, and reports success',
    async (role) => {
      vi.resetModules()
      const registerPage = vi.fn()
      const unbindResult = deferred<void>()
      const unbindWechat = vi.fn().mockReturnValue(unbindResult.promise)
      let modal: { success(result: { confirm: boolean }): void } | undefined
      const showModal = vi.fn((options) => {
        modal = options
      })
      const showToast = vi.fn()
      const reLaunch = vi.fn()
      vi.doMock('../miniprogram/services/auth', () => ({
        merchantAuthService: { logout: vi.fn(), unbindWechat },
      }))
      vi.stubGlobal('Page', registerPage)
      vi.stubGlobal('wx', { showModal, showToast, reLaunch })
      await import('../miniprogram/pages/account-wechat/index')
      const definition = registerPage.mock.calls[0][0] as Record<string, unknown> & {
        confirmUnbind(): Promise<void>
      }
      const context = {
        ...definition,
        data: {
          session: sessionForRole(role),
          shortcuts: [],
          isLoading: false,
          isUnbinding: false,
          errorMessage: '',
        },
        setData(values: Record<string, unknown>) {
          Object.assign(this.data, values)
        },
      }

      const firstTap = definition.confirmUnbind.call(context)
      const secondTap = definition.confirmUnbind.call(context)

      expect(showModal).toHaveBeenCalledOnce()
      expect(unbindWechat).not.toHaveBeenCalled()
      expect(context.data.isUnbinding).toBe(true)

      modal?.success({ confirm: true })
      await Promise.resolve()
      expect(unbindWechat).toHaveBeenCalledOnce()
      unbindResult.resolve()
      await Promise.all([firstTap, secondTap])

      expect(showToast).toHaveBeenCalledWith({
        title: '微信已解绑',
        icon: 'success',
      })
      expect(reLaunch).toHaveBeenCalledWith({ url: '/pages/login/index' })
      expect(context.data.isUnbinding).toBe(false)
    },
  )

  test('keeps the profile open and shows a recoverable error when unbinding fails', async () => {
    vi.resetModules()
    const registerPage = vi.fn()
    const unbindWechat = vi.fn().mockRejectedValue(new Error('网络连接失败，请检查网络后重试'))
    let modal: { success(result: { confirm: boolean }): void } | undefined
    const reLaunch = vi.fn()
    vi.doMock('../miniprogram/services/auth', () => ({
      merchantAuthService: { logout: vi.fn(), unbindWechat },
    }))
    vi.stubGlobal('Page', registerPage)
    vi.stubGlobal('wx', {
      showModal: vi.fn((options) => { modal = options }),
      showToast: vi.fn(),
      reLaunch,
    })
    await import('../miniprogram/pages/account-wechat/index')
    const definition = registerPage.mock.calls[0][0] as Record<string, unknown> & {
      confirmUnbind(): Promise<void>
    }
    const context = {
      ...definition,
      data: {
        session: sessionForRole('CASHIER'),
        shortcuts: [],
        isLoading: false,
        isUnbinding: false,
        errorMessage: '',
      },
      setData(values: Record<string, unknown>) {
        Object.assign(this.data, values)
      },
    }

    const pending = definition.confirmUnbind.call(context)
    modal?.success({ confirm: true })
    await pending

    expect(context.data.errorMessage).toBe('网络连接失败，请检查网络后重试')
    expect(context.data.isUnbinding).toBe(false)
    expect(reLaunch).not.toHaveBeenCalled()
  })
})

describe('merchant profile child navigation', () => {
  test('opens account and WeChat as a child page so back returns to profile', async () => {
    vi.resetModules()
    const registerPage = vi.fn()
    const navigateTo = vi.fn()
    const redirectTo = vi.fn()
    vi.stubGlobal('Page', registerPage)
    vi.stubGlobal('wx', { navigateTo, redirectTo })

    await import('../miniprogram/pages/profile/index')
    const definition = registerPage.mock.calls[0][0] as Record<string, unknown> & {
      onShortcutTap(event: { currentTarget: { dataset: { id: string } } }): void
    }
    const context = {
      ...definition,
      data: {
        shortcuts: [{ id: 'account', url: '/pages/account-wechat/index' }],
      },
    }

    definition.onShortcutTap.call(context, {
      currentTarget: { dataset: { id: 'account' } },
    })

    expect(navigateTo).toHaveBeenCalledWith({ url: '/pages/account-wechat/index' })
    expect(redirectTo).not.toHaveBeenCalled()
  })
})
