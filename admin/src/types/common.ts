export interface ApiResponse<T> {
  code: string
  message: string
  requestId: string
  data: T
}

export interface PageResult<T> {
  items: T[]
  page: number
  size: number
  total: number
}

export type StaffRole = 'OWNER' | 'CASHIER'

export interface StaffSession {
  accessToken: string
  role: StaffRole
  staffId: number
  username: string
}
