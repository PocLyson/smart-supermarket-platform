import { announcementsService } from '../../services/announcements'
import type { Announcement } from '../../types/announcement'

const pageSize = 20

type AnnouncementCard = Announcement & {
  displayPublishedAt: string
}

const formatPublishedAt = (value: string): string =>
  value ? value.replace('T', ' ').slice(0, 16) : '发布时间以门店为准'

Page({
  data: {
    announcements: [] as AnnouncementCard[],
    page: 0,
    loading: false,
    error: '',
    empty: false,
    reachedEnd: false,
  },

  onLoad() {
    void this.loadAnnouncements(true)
  },

  onReachBottom() {
    if (!this.data.loading && !this.data.reachedEnd) {
      void this.loadAnnouncements(false)
    }
  },

  async loadAnnouncements(reset: boolean) {
    if (this.data.loading && !reset) return
    const page = reset ? 0 : this.data.page
    this.setData({ loading: true, error: '' })
    try {
      const result = await announcementsService.list(page, pageSize)
      const incoming = result.items.map((announcement) => ({
        ...announcement,
        displayPublishedAt: formatPublishedAt(announcement.publishedAt),
      }))
      const announcements = reset
        ? incoming
        : [...this.data.announcements, ...incoming]
      this.setData({
        announcements,
        page: page + 1,
        empty: announcements.length === 0,
        reachedEnd:
          announcements.length >= result.total || result.items.length < pageSize,
      })
    } catch (error) {
      this.setData({
        error: error instanceof Error ? error.message : '公告加载失败',
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  onOpenAnnouncement(event: WechatMiniprogram.TouchEvent) {
    const id = Number(event.currentTarget.dataset.id)
    if (!Number.isSafeInteger(id) || id <= 0) return
    wx.navigateTo({ url: `/pages/announcement-detail/index?id=${id}` })
  },

  onRetry() {
    void this.loadAnnouncements(true)
  },
})
