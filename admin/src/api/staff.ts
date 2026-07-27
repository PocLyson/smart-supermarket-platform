import { jsonBody, request } from './http'
import type { StaffRole } from '@/types/common'

export interface StaffAccount {
  id: number
  username: string
  role: StaffRole
  enabled: boolean
  lastLoginAt: string | null
  createdAt: string
}

export interface CreateCashierRequest {
  username: string
  password: string
}

export interface ResetPasswordRequest {
  password: string
}

export const listStaff = (): Promise<StaffAccount[]> => request('/api/admin/staff')

export const createCashier = (payload: CreateCashierRequest): Promise<StaffAccount> =>
  request('/api/admin/staff', { method: 'POST', ...jsonBody(payload) })

export const setStaffEnabled = (id: number, enabled: boolean): Promise<StaffAccount> =>
  request(`/api/admin/staff/${id}/enabled`, {
    method: 'PATCH',
    ...jsonBody({ enabled }),
  })

export const resetStaffPassword = (id: number, payload: ResetPasswordRequest): Promise<void> =>
  request(`/api/admin/staff/${id}/reset-password`, {
    method: 'POST',
    ...jsonBody(payload),
  })
