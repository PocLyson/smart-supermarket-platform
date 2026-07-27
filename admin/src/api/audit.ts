import { request } from './http'
import type { PageResult } from '@/types/common'
import { toQueryString } from '@/utils/query'

export interface AuditLog {
  id: number
  actorId: number
  actorName: string
  action: string
  objectType: string
  objectId: string
  resultSummary: string
  requestId: string
  createdAt: string
}

export interface AuditLogQuery {
  actorId?: number
  action?: string
  objectType?: string
  page?: number
  size?: number
}

export const listAuditLogs = (query: AuditLogQuery = {}): Promise<PageResult<AuditLog>> =>
  request(
    `/api/admin/audit-logs${toQueryString({
      actorId: query.actorId,
      action: query.action,
      objectType: query.objectType,
      page: query.page,
      size: query.size,
    })}`,
  )
