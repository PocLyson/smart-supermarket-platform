import { jsonBody, request } from './http'
import type { StaffSession } from '@/types/common'

export interface LoginRequest {
  username: string
  password: string
}

export const login = (payload: LoginRequest): Promise<StaffSession> =>
  request('/api/admin/auth/login', {
    method: 'POST',
    ...jsonBody(payload),
  })
