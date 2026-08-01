import { announcementsService } from '../../services/announcements'
import type { Announcement } from '../../types/announcement'

const formatPublishedAt = (value: string): string =>
  value ? value.replace('T', ' ').slice(0, 16) : ''

Page({
  data: {
    announcement: undefined as Announcement | undefined,
    displayPublishedAt: '',
    loading: true,
    ended: false,
  },

  onLoad(query: Record<string, string | undefined>) {
    const id = Number(query.id)
    if (!Number.isSafeInteger(id) || id <= 0) {
      this.setData({ loading: false, ended: true })
      return
    }
    void this.loadAnnouncement(id)
  },

  async loadAnnouncement(id: number) {
    this.setData({ loading: true, ended: false })
    try {
      const announcement = await announcementsService.detail(id)
      this.setData({
        announcement,
        displayPublishedAt: formatPublishedAt(announcement.publishedAt),
      })
    } catch {
      this.setData({ announcement: undefined, ended: true })
    } finally {
      this.setData({ loading: false })
    }
  },

  onBack() {
    wx.navigateBack({
      fail: () => wx.reLaunch({ url: '/pages/announcements/index' }),
    })
  },
})
