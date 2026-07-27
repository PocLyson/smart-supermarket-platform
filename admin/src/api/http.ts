import type { ApiResponse } from '@/types/common'
import { ElMessage } from 'element-plus'

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly requestId: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

const SESSION_KEY = 'smart-store-admin-session'

const readToken = (): string | undefined => {
  const raw = localStorage.getItem(SESSION_KEY)
  if (!raw) return undefined
  try {
    return (JSON.parse(raw) as { accessToken?: string }).accessToken
  } catch {
    localStorage.removeItem(SESSION_KEY)
    return undefined
  }
}

const apiBaseUrl = (): string => (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  const token = readToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(`${apiBaseUrl()}${path}`, { ...options, headers })
  if (response.status === 401) {
    localStorage.removeItem(SESSION_KEY)
    if (window.location.pathname !== '/login') window.location.assign('/login')
  }

  let envelope: ApiResponse<T>
  try {
    envelope = (await response.json()) as ApiResponse<T>
  } catch {
    throw new ApiError('服务器响应格式错误', 'INVALID_RESPONSE', '', response.status)
  }

  if (!response.ok || envelope.code !== 'OK') {
    if (envelope.message) ElMessage.error(envelope.message)
    throw new ApiError(
      envelope.message || '请求失败',
      envelope.code,
      envelope.requestId,
      response.status,
    )
  }
  return envelope.data
}

export const jsonBody = (value: unknown): Pick<RequestInit, 'body'> => ({
  body: JSON.stringify(value),
})
