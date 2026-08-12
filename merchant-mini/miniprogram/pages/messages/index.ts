import { merchantSupportService } from '../../services/support'
import { merchantSessionStore } from '../../store/session'
import type { MerchantSupportConversation } from '../../types/support'
import { syncConversationListUnread } from '../../store/message-unread'

type PresentedConversation = MerchantSupportConversation & { displayTime: string }

const present = (item: MerchantSupportConversation): PresentedConversation => ({
  ...item,
  displayTime: item.lastMessageAt
    ? item.lastMessageAt.replace('T', ' ').slice(5, 16)
    : '',
})

Page({
  data: {
    conversations: [] as PresentedConversation[],
    loading: false,
    errorMessage: '',
    hasLoaded: false,
  },

  timer: undefined as ReturnType<typeof setInterval> | undefined,
  refreshGeneration: 0,
  inFlightGeneration: -1,

  onShow() {
    if (!merchantSessionStore.current()) {
      wx.reLaunch({ url: '/pages/login/index' })
      return
    }
    this.startPolling()
  },

  onHide() {
    this.stopPolling()
  },

  onUnload() {
    this.stopPolling()
  },

  startPolling() {
    this.stopPolling()
    this.refreshGeneration += 1
    const generation = this.refreshGeneration
    void this.loadConversations(generation)
    this.timer = setInterval(() => void this.loadConversations(generation, true), 10_000)
  },

  stopPolling() {
    this.refreshGeneration += 1
    if (this.timer) clearInterval(this.timer)
    this.timer = undefined
  },

  async loadConversations(generation: number, quiet = false) {
    if (this.inFlightGeneration === generation) return
    this.inFlightGeneration = generation
    if (!quiet) this.setData({ loading: true, errorMessage: '' })
    try {
      const result = await merchantSupportService.list(0, 50)
      if (generation !== this.refreshGeneration) return
      syncConversationListUnread(result.items)
      this.setData({
        conversations: result.items.map(present),
        hasLoaded: true,
        errorMessage: '',
      })
    } catch (error) {
      if (generation !== this.refreshGeneration || quiet) return
      this.setData({
        errorMessage: error instanceof Error ? error.message : '消息加载失败，请重试',
      })
    } finally {
      if (this.inFlightGeneration === generation) this.inFlightGeneration = -1
      if (!quiet && generation === this.refreshGeneration) this.setData({ loading: false })
    }
  },

  onOpenConversation(event: WechatMiniprogram.TouchEvent) {
    const id = Number(event.currentTarget.dataset.id)
    if (!Number.isSafeInteger(id) || id <= 0) return
    const item = this.data.conversations.find((conversation) => conversation.id === id)
    if (!item) return
    wx.navigateTo({
      url: `/pages/message-detail/index?id=${id}&name=${encodeURIComponent(item.displayName)}&phone=${encodeURIComponent(item.maskedPhone)}&orderNo=${encodeURIComponent(item.lastRelatedOrderNo || '')}`,
    })
  },

  retry() {
    void this.loadConversations(this.refreshGeneration)
  },
})
