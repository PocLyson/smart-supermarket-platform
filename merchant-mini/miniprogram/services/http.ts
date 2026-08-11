import { getApiBaseUrl } from '../config/env'
import {
  merchantSessionStore,
  type MerchantSessionStore,
} from '../store/session'

export interface ApiResponse<T> {
  code: string
  message: string
  requestId: string
  data: T
}

export interface MerchantRequestOptions {
  url: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: unknown
  header?: Record<string, string>
}

interface MerchantTransportResponse {
  statusCode: number
  data: unknown
}

export interface MerchantHttp {
  get<T>(path: string, data?: unknown, policy?: MerchantRequestPolicy): Promise<T>
  post<T>(path: string, data?: unknown, policy?: MerchantRequestPolicy): Promise<T>
  put<T>(path: string, data?: unknown, policy?: MerchantRequestPolicy): Promise<T>
  delete<T>(path: string, data?: unknown, policy?: MerchantRequestPolicy): Promise<T>
}

export interface MerchantRequestPolicy {
  authorization: 'public' | 'protected'
  headers?: Record<string, string>
}

interface MerchantHttpDependencies {
  request(options: MerchantRequestOptions): Promise<unknown>
  session: MerchantSessionStore
  apiBaseUrl?: () => string
  onUnauthorized?: () => void
}

export class HttpResponseError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly code: string,
    readonly requestId: string,
  ) {
    super(message)
    this.name = 'HttpResponseError'
  }
}

const isTransportResponse = (value: unknown): value is MerchantTransportResponse =>
  Boolean(
    value &&
      typeof value === 'object' &&
      typeof (value as Partial<MerchantTransportResponse>).statusCode === 'number' &&
      'data' in value,
  )

const isApiResponse = (value: unknown): value is ApiResponse<unknown> =>
  Boolean(
    value &&
      typeof value === 'object' &&
      typeof (value as Partial<ApiResponse<unknown>>).code === 'string' &&
      typeof (value as Partial<ApiResponse<unknown>>).message === 'string' &&
      typeof (value as Partial<ApiResponse<unknown>>).requestId === 'string' &&
      'data' in value,
  )

const compactQuery = (data?: unknown): unknown => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return data
  return Object.fromEntries(
    Object.entries(data as Record<string, unknown>)
      .filter(([, value]) => value !== undefined),
  )
}

export const createMerchantHttp = ({
  request,
  session,
  apiBaseUrl = () => '',
  onUnauthorized = () => undefined,
}: MerchantHttpDependencies): MerchantHttp => {
  let handledUnauthorizedRevision: number | undefined

  const send = async <T>(
    method: MerchantRequestOptions['method'],
    path: string,
    data?: unknown,
    policy: MerchantRequestPolicy = { authorization: 'protected' },
  ): Promise<T> => {
    const protectedRequest = policy.authorization === 'protected'
    const current = protectedRequest ? session.current() : undefined
    const requestToken = current?.accessToken
    const requestRevision = session.revision()
    const header = {
      ...policy.headers,
      ...(current ? { Authorization: `Bearer ${current.accessToken}` } : {}),
    }
    const response = await request({
      url: `${apiBaseUrl()}${path}`,
      method,
      data: method === 'GET' ? compactQuery(data) : data,
      header: Object.keys(header).length > 0 ? header : undefined,
    })

    if (!isTransportResponse(response)) return response as T
    const { statusCode, data: body } = response
    if (statusCode === 401 && protectedRequest) {
      const currentSession = session.current()
      const currentRevision = session.revision()
      const sameRevision = currentRevision === requestRevision
      const sameSession = Boolean(
        currentSession &&
          currentSession.accessToken === requestToken &&
          sameRevision,
      )
      const sameClearedSession = !currentSession && (
        sameRevision || currentRevision === requestRevision + 1
      )
      const requestStillOwnsSession = sameSession || sameClearedSession
      if (
        requestStillOwnsSession &&
        handledUnauthorizedRevision !== requestRevision
      ) {
        handledUnauthorizedRevision = requestRevision
        session.clear()
        onUnauthorized()
      }
    }
    if (!isApiResponse(body)) {
      throw new Error('服务响应异常，请重试')
    }
    if (statusCode >= 200 && statusCode < 300 && body.code === 'OK') {
      return body.data as T
    }
    throw new HttpResponseError(
      body.message || '请求失败，请重试',
      statusCode,
      body.code,
      body.requestId,
    )
  }

  return {
    get: <T>(path: string, data?: unknown, policy?: MerchantRequestPolicy) =>
      send<T>('GET', path, data, policy),
    post: <T>(path: string, data?: unknown, policy?: MerchantRequestPolicy) =>
      send<T>('POST', path, data, policy),
    put: <T>(path: string, data?: unknown, policy?: MerchantRequestPolicy) =>
      send<T>('PUT', path, data, policy),
    delete: <T>(path: string, data?: unknown, policy?: MerchantRequestPolicy) =>
      send<T>('DELETE', path, data, policy),
  }
}

const wxRequest = (options: MerchantRequestOptions): Promise<unknown> =>
  new Promise((resolve, reject) => {
    wx.request({
      url: options.url,
      method: options.method,
      data: options.data as WechatMiniprogram.IAnyObject | undefined,
      header: options.header,
      success: ({ statusCode, data }) => resolve({ statusCode, data }),
      fail: () => reject(new Error('网络连接失败，请检查网络后重试')),
    })
  })

export const merchantHttp = createMerchantHttp({
  request: wxRequest,
  session: merchantSessionStore,
  apiBaseUrl: getApiBaseUrl,
  onUnauthorized: () => wx.reLaunch({ url: '/pages/login/index' }),
})
