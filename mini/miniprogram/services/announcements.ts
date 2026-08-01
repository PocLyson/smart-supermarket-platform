import type { PageResult } from '../types/catalog'
import type { Announcement } from '../types/announcement'
import { http, type HttpClient } from './http'

type AnnouncementsHttp = Pick<HttpClient, 'get'>

export const createAnnouncementsService = (client: AnnouncementsHttp) => ({
  latest: (): Promise<Announcement | null> =>
    client.get<Announcement | null>('/api/mini/announcements/latest'),
  list: (page = 0, size = 20): Promise<PageResult<Announcement>> =>
    client.get<PageResult<Announcement>>('/api/mini/announcements', {
      page,
      size,
    }),
  detail: (id: number): Promise<Announcement> =>
    client.get<Announcement>(`/api/mini/announcements/${id}`),
})

export const announcementsService = createAnnouncementsService(http)
