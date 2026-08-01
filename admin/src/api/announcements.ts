import { jsonBody, request } from './http'
import type { PageResult } from '@/types/common'
import { toQueryString } from '@/utils/query'

export type AnnouncementStatus = 'DRAFT' | 'PUBLISHED' | 'OFFLINE'

export interface Announcement {
  id: number
  title: string
  content: string
  status: AnnouncementStatus
  publishedAt: string | null
  createdBy: number
  updatedBy: number
  createdAt: string
  updatedAt: string
}

export interface AnnouncementQuery {
  status?: AnnouncementStatus
  page?: number
  size?: number
}

export interface AnnouncementWriteRequest {
  title: string
  content: string
}

export const listAnnouncements = (
  query: AnnouncementQuery = {},
): Promise<PageResult<Announcement>> =>
  request(
    `/api/admin/announcements${toQueryString({
      status: query.status,
      page: query.page,
      size: query.size,
    })}`,
  )

export const createAnnouncement = (payload: AnnouncementWriteRequest): Promise<Announcement> =>
  request('/api/admin/announcements', { method: 'POST', ...jsonBody(payload) })

export const updateAnnouncement = (
  id: number,
  payload: AnnouncementWriteRequest,
): Promise<Announcement> =>
  request(`/api/admin/announcements/${id}`, { method: 'PUT', ...jsonBody(payload) })

export const publishAnnouncement = (id: number): Promise<Announcement> =>
  request(`/api/admin/announcements/${id}/publish`, { method: 'POST' })

export const offlineAnnouncement = (id: number): Promise<Announcement> =>
  request(`/api/admin/announcements/${id}/offline`, { method: 'POST' })

export const deleteAnnouncement = (id: number): Promise<{ deleted: boolean }> =>
  request(`/api/admin/announcements/${id}`, { method: 'DELETE' })
