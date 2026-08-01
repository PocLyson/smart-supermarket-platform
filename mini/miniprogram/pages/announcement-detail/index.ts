import { announcementsService } from '../../services/announcements'
import type { Announcement } from '../../types/announcement'
import { announcementDetailFailureState } from './state'

const formatPublishedAt = (value: string): string =>
  value ? value.replace('T', ' ').slice(0, 16) : ''

Page({
  data: {
    announcement: undefined as Announcement | undefined,
    displayPublishedAt: '',
    loading: true,
    ended: false,
    loadError: '',
    announcementId: 0,
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
    this.setData({ announcementId: id, loading: true, ended: false, loadError: '' })
    try {
      const announcement = await announcementsService.detail(id)
      this.setData({
        announcement,
        displayPublishedAt: formatPublishedAt(announcement.publishedAt),
      })
    } catch (error) {
      this.setData({
        announcement: undefined,
        ...announcementDetailFailureState(error),
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  onRetry() {
    if (this.data.announcementId > 0) {
      void this.loadAnnouncement(this.data.announcementId)
    }
  },

  onBack() {
    wx.navigateBack({
      fail: () => wx.reLaunch({ url: '/pages/announcements/index' }),
    })
  },
})
