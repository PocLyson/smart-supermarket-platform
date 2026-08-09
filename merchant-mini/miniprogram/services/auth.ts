import {
  merchantSessionStore,
  type MerchantSession,
  type MerchantSessionStore,
} from '../store/session'
import {
  HttpResponseError,
  merchantHttp,
  type MerchantHttp,
} from './http'
import {
  merchantOrderReminderLifecycle,
  type MerchantOrderReminderLifecycle,
} from '../utils/order-reminder'

export interface WechatLogin {
  (): Promise<{ code: string }>
}

interface MerchantAuthDependencies {
  client: Pick<MerchantHttp, 'post'>
  session: Pick<MerchantSessionStore, 'current' | 'save' | 'clear'>
  login: WechatLogin
  reminderLifecycle?: Pick<
    MerchantOrderReminderLifecycle,
    'authenticated' | 'signedOut'
  >
}

type ApiMerchantSession = Omit<MerchantSession, 'expiresAt'> & {
  expiresAt: number | string
}

const normalizeSession = (value: ApiMerchantSession): MerchantSession => {
  const expiresAt =
    typeof value.expiresAt === 'number'
      ? value.expiresAt
      : Date.parse(value.expiresAt)
  if (!Number.isFinite(expiresAt)) {
    throw new Error('登录响应缺少有效的过期时间，请重试')
  }
  return { ...value, expiresAt }
}

export const loginWithWx: WechatLogin = () =>
  new Promise((resolve, reject) => {
    wx.login({
      success: ({ code }) =>
        code
          ? resolve({ code })
          : reject(new Error('微信登录未返回有效凭证，请重试')),
      fail: () => reject(new Error('微信登录失败，请重试')),
    })
  })

export const createMerchantAuthService = ({
  client,
  session,
  login,
  reminderLifecycle = {
    authenticated: async () => undefined,
    signedOut: () => undefined,
  },
}: MerchantAuthDependencies) => {
  const activateReminder = (): void => {
    void reminderLifecycle.authenticated().catch(() => undefined)
  }

  const loginWithWechat = async (): Promise<MerchantSession> => {
    const { code } = await login()
    const response = await client.post<ApiMerchantSession>(
      '/api/merchant-mini/auth/wechat-login',
      { code },
      { authorization: 'public' },
    )
    const result = normalizeSession(response)
    session.save(result)
    activateReminder()
    return result
  }

  return {
    requiresPasswordBinding: (error: unknown): boolean =>
      error instanceof HttpResponseError && error.code === 'MERCHANT_NOT_BOUND',

    loginWithWechat,

    resumeOrLogin: async (): Promise<MerchantSession> =>
      session.current() || loginWithWechat(),

    loginWithPassword: async (
      username: string,
      password: string,
      confirmed: boolean,
    ): Promise<MerchantSession> => {
      if (!confirmed) throw new Error('请确认绑定当前微信')
      const { code } = await login()
      const response = await client.post<ApiMerchantSession>(
        '/api/merchant-mini/auth/password-login',
        { username, password, code },
        { authorization: 'public' },
      )
      const result = normalizeSession(response)
      session.save(result)
      activateReminder()
      return result
    },

    logout: async (): Promise<void> => {
      try {
        await client.post('/api/merchant-mini/auth/logout')
      } finally {
        session.clear()
        reminderLifecycle.signedOut()
      }
    },
  }
}

export const merchantAuthService = createMerchantAuthService({
  client: merchantHttp,
  session: merchantSessionStore,
  login: loginWithWx,
  reminderLifecycle: merchantOrderReminderLifecycle,
})
