import { apiBaseUrl } from '../config/env'

export interface ApiResponse<T> {
  code: string
  message: string
  requestId: string
  data: T
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: unknown
  headers?: Record<string, string>
}

export class NetworkUncertainError extends Error {
  constructor(message = '网络状态不确定，请稍后确认订单结果') {
    super(message)
    this.name = 'NetworkUncertainError'
  }
}

let unauthorizedHandler: (() => void) | undefined

export const setUnauthorizedHandler = (handler: () => void): void => {
  unauthorizedHandler = handler
}

const showError = (message: string): void => {
  wx.showToast({ title: message || '请求失败，请稍后重试', icon: 'none' })
}

const request = <T>(path: string, options: RequestOptions = {}): Promise<T> =>
  new Promise((resolve, reject) => {
    wx.request<ApiResponse<T>>({
      url: `${apiBaseUrl}${path}`,
      method: options.method ?? 'GET',
      data: options.data as
        | string
        | WechatMiniprogram.IAnyObject
        | ArrayBuffer
        | undefined,
      header: options.headers,
      success: ({ statusCode, data }) => {
        if (statusCode >= 200 && statusCode < 300 && data.code === 'OK') {
          resolve(data.data)
          return
        }
        if (statusCode === 401) unauthorizedHandler?.()
        const error = new Error(data.message || '请求失败，请稍后重试')
        showError(error.message)
        reject(error)
      },
      fail: () => {
        const error = new NetworkUncertainError()
        showError(error.message)
        reject(error)
      },
    })
  })

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
}

export const http: HttpClient = {
  get: <T>(
    path: string,
    query?: Record<string, unknown>,
    headers?: Record<string, string>,
  ) => request<T>(path, { data: query, headers }),
  post: <T>(
    path: string,
    data?: unknown,
    headers?: Record<string, string>,
  ) => request<T>(path, { method: 'POST', data, headers }),
  put: <T>(
    path: string,
    data?: unknown,
    headers?: Record<string, string>,
  ) => request<T>(path, { method: 'PUT', data, headers }),
}
