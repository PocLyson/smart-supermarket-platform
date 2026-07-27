import {
  sessionStore,
  type CustomerSession,
  type SessionStore,
} from '../store/session'
import { http, setUnauthorizedHandler, type HttpClient } from './http'

export interface CustomerProfile {
  pickupName: string
  phone: string
}

export interface WechatLogin {
  (): Promise<{ code: string }>
}

interface AuthDependencies {
  client: Pick<HttpClient, 'post'>
  session: SessionStore
  login: WechatLogin
}

const authorization = (token: string): Record<string, string> => ({
  Authorization: `Bearer ${token}`,
})

export const loginWithWx: WechatLogin = () =>
  new Promise((resolve, reject) => {
    wx.login({
      success: ({ code }) =>
        code ? resolve({ code }) : reject(new Error('微信登录未返回有效凭证')),
      fail: () => reject(new Error('微信登录失败，请重试')),
    })
  })

export const createAuthService = ({
  client,
  session,
  login,
}: AuthDependencies) => ({
  loginWithWechat: async (): Promise<CustomerSession> => {
    const { code } = await login()
    const result = await client.post<CustomerSession>(
      '/api/mini/auth/wechat',
      { code },
    )
    session.save(result)
    return result
  },
  ensureSession: async (): Promise<CustomerSession> => {
    const existing = session.current()
    if (existing) return existing
    const { code } = await login()
    const result = await client.post<CustomerSession>(
      '/api/mini/auth/wechat',
      { code },
    )
    session.save(result)
    return result
  },
})

export const createProfileService = (
  client: Pick<HttpClient, 'get' | 'put'>,
  session: SessionStore,
) => ({
  get: (): Promise<CustomerProfile> => {
    const current = session.current()
    if (!current) return Promise.reject(new Error('请先登录'))
    return client.get<CustomerProfile>(
      '/api/mini/profile',
      undefined,
      authorization(current.accessToken),
    )
  },
  save: (profile: CustomerProfile): Promise<CustomerProfile> => {
    const current = session.current()
    if (!current) return Promise.reject(new Error('请先登录'))
    return client.put<CustomerProfile>(
      '/api/mini/profile',
      profile,
      authorization(current.accessToken),
    )
  },
})

setUnauthorizedHandler(() => sessionStore.clear())

export const authService = createAuthService({
  client: http,
  session: sessionStore,
  login: loginWithWx,
})

export const profileService = createProfileService(http, sessionStore)
