import { getApiBaseUrl } from '../config/env'
import { sessionStore } from '../store/session'

export interface ApiResponse<T> {
  code: string
  message: string
  requestId: string
  data: T
}

export interface HttpClient {
  get<T>(
    path: string,
    query?: Record<string, unknown>,
    headers?: Record<string, string>,
  ): Promise<T>
  post<T>(
    path: string,
    data?: unknown,
    headers?: Record<string, string>,
  ): Promise<T>
  put<T>(
    path: string,
    data?: unknown,
    headers?: Record<string, string>,
  ): Promise<T>
  delete<T>(
    path: string,
    data?: unknown,
    headers?: Record<string, string>,
  ): Promise<T>
}

export interface TransportOptions {
  url: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: unknown
  headers?: Record<string, string>
  success(response: { statusCode: number; data: unknown }): void
  fail(): void
}

export interface HttpClientDependencies {
  apiBaseUrl: () => string
  transport: (options: TransportOptions) => void
  showError: (message: string) => void
  onUnauthorized: () => void
}

export class NetworkUncertainError extends Error {
  constructor(message = '网络状态不确定，请稍后确认订单结果') {
    super(message)
    this.name = 'NetworkUncertainError'
  }
}

const isApiResponse = (value: unknown): value is ApiResponse<unknown> => {
  if (!value || typeof value !== 'object') return false
  const envelope = value as Partial<ApiResponse<unknown>>
  return (
    typeof envelope.code === 'string' &&
    typeof envelope.message === 'string' &&
    typeof envelope.requestId === 'string' &&
    'data' in envelope
  )
}

const compactQuery = (
  query?: Record<string, unknown>,
): Record<string, unknown> | undefined => {
  if (!query) return undefined
  return Object.fromEntries(
    Object.entries(query).filter(([, value]) => value !== undefined),
  )
}

export const createHttpClient = (
  dependencies: HttpClientDependencies,
): HttpClient => {
  const request = <T>(
    path: string,
    method: TransportOptions['method'],
    data?: unknown,
    headers?: Record<string, string>,
  ): Promise<T> =>
    new Promise((resolve, reject) => {
      let baseUrl: string
      try {
        baseUrl = dependencies.apiBaseUrl()
      } catch (error) {
        const message =
          error instanceof Error ? error.message : '小程序 API 地址配置错误'
        dependencies.showError(message)
        reject(new Error(message))
        return
      }
      dependencies.transport({
        url: `${baseUrl}${path}`,
        method,
        data,
        headers,
        success: ({ statusCode, data: responseData }) => {
          if (statusCode === 401) dependencies.onUnauthorized()
          if (!isApiResponse(responseData)) {
            const error = new NetworkUncertainError('服务响应异常，请稍后重试')
            dependencies.showError(error.message)
            reject(error)
            return
          }
          if (statusCode === 408 || statusCode >= 500) {
            const error = new NetworkUncertainError(
              responseData.message || '服务响应异常，请稍后重试',
            )
            dependencies.showError(error.message)
            reject(error)
            return
          }
          if (
            statusCode >= 200 &&
            statusCode < 300 &&
            responseData.code === 'OK'
          ) {
            resolve(responseData.data as T)
            return
          }
          const error = new Error(responseData.message || '请求失败，请稍后重试')
          dependencies.showError(error.message)
          reject(error)
        },
        fail: () => {
          const error = new NetworkUncertainError()
          dependencies.showError(error.message)
          reject(error)
        },
      })
    })

  return {
    get: <T>(
      path: string,
      query?: Record<string, unknown>,
      headers?: Record<string, string>,
    ) => request<T>(path, 'GET', compactQuery(query), headers),
    post: <T>(
      path: string,
      data?: unknown,
      headers?: Record<string, string>,
    ) => request<T>(path, 'POST', data, headers),
    put: <T>(
      path: string,
      data?: unknown,
      headers?: Record<string, string>,
    ) => request<T>(path, 'PUT', data, headers),
    delete: <T>(
      path: string,
      data?: unknown,
      headers?: Record<string, string>,
    ) => request<T>(path, 'DELETE', data, headers),
  }
}

const wxTransport = (options: TransportOptions): void => {
  wx.request<ApiResponse<unknown>>({
    url: options.url,
    method: options.method,
    data: options.data as
      | string
      | WechatMiniprogram.IAnyObject
      | ArrayBuffer
      | undefined,
    header: options.headers,
    success: ({ statusCode, data }) =>
      options.success({ statusCode, data }),
    fail: () => options.fail(),
  })
}

export const http = createHttpClient({
  apiBaseUrl: getApiBaseUrl,
  transport: wxTransport,
  showError: (message) =>
    wx.showToast({ title: message || '请求失败，请稍后重试', icon: 'none' }),
  onUnauthorized: () => sessionStore.clear(),
})
