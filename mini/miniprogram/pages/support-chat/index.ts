import { supportService } from '../../services/support'
import { sessionStore } from '../../store/session'
import type { SupportMessage } from '../../types/support'
import { createSupportPoller, type SupportPoller } from '../../utils/support-poller'

type PresentedMessage = SupportMessage & {
  isMine: boolean
  displayTime: string
}

const presentMessage = (message: SupportMessage): PresentedMessage => ({
  ...message,
  isMine: message.senderType === 'CUSTOMER',
  displayTime: message.createdAt
    ? message.createdAt.replace('T', ' ').slice(5, 16)
    : '',
})

const createClientMessageId = (): string =>
  `customer-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

Page({
  data: {
    conversationId: 0,
    orderNo: '',
    messages: [] as PresentedMessage[],
    draft: '',
    loading: true,
    sending: false,
    error: '',
    scrollIntoView: '',
  },

  poller: undefined as SupportPoller | undefined,
  visible: false,
  initialized: false,
  pendingMessageId: '',
  pendingContent: '',

  onLoad(query: Record<string, string | undefined>) {
    if (!sessionStore.current()) {
      wx.showModal({
        title: '登录后联系门店',
        content: '登录后可以发送消息并查看门店回复。',
        confirmText: '去登录',
        success: ({ confirm }) => {
          if (confirm) wx.redirectTo({ url: '/pages/auth/index' })
          else wx.navigateBack()
        },
      })
      return
    }
    const orderNo = query.orderNo ? decodeURIComponent(query.orderNo) : ''
    this.setData({ orderNo })
    this.poller = createSupportPoller({
      poll: () => this.pollMessages(),
      schedule: (callback, delay) => setTimeout(callback, delay),
      cancel: (timer) => timer !== undefined && clearTimeout(timer),
      intervalMs: 10_000,
    })
    void this.initialize()
  },

  onShow() {
    this.visible = true
    if (this.initialized) this.poller?.start()
  },

  onHide() {
    this.visible = false
    this.poller?.stop()
  },

  onUnload() {
    this.visible = false
    this.poller?.stop()
  },

  async initialize() {
    this.setData({ loading: true, error: '' })
    try {
      const conversation = await supportService.open(this.data.orderNo || undefined)
      const messages = await supportService.messages(conversation.id)
      this.initialized = true
      this.setData({
        conversationId: conversation.id,
        messages: messages.map(presentMessage),
        scrollIntoView: messages.length ? `message-${messages[messages.length - 1].id}` : '',
      })
      await this.markLatestRead(messages)
      if (this.visible) this.poller?.start()
    } catch (error) {
      this.setData({ error: error instanceof Error ? error.message : '消息加载失败' })
    } finally {
      this.setData({ loading: false })
    }
  },

  async pollMessages() {
    if (!this.data.conversationId) return
    const afterId = this.data.messages[this.data.messages.length - 1]?.id || 0
    try {
      const incoming = await supportService.messages(this.data.conversationId, afterId)
      if (!incoming.length) return
      const known = new Set(this.data.messages.map((message) => message.id))
      const merged = [
        ...this.data.messages,
        ...incoming.filter((message) => !known.has(message.id)).map(presentMessage),
      ]
      this.setData({
        messages: merged,
        scrollIntoView: `message-${merged[merged.length - 1]?.id}`,
      })
      await this.markLatestRead(incoming)
    } catch {
      // Background refresh remains quiet; manual actions keep explicit errors.
    }
  },

  async markLatestRead(messages: SupportMessage[]) {
    const latest = messages[messages.length - 1]
    if (!latest || latest.senderType !== 'MERCHANT') return
    try {
      await supportService.markRead(this.data.conversationId, latest.id)
    } catch {
      // A later poll retries the read boundary safely.
    }
  },

  onDraftInput(event: WechatMiniprogram.Input) {
    const draft = String(event.detail.value || '')
    if (draft.trim() !== this.pendingContent) {
      this.pendingMessageId = ''
      this.pendingContent = ''
    }
    this.setData({ draft, error: '' })
  },

  async onSend() {
    const content = this.data.draft.trim()
    if (!content || this.data.sending || !this.data.conversationId) return
    if (!this.pendingMessageId || this.pendingContent !== content) {
      this.pendingMessageId = createClientMessageId()
      this.pendingContent = content
    }
    const clientMessageId = this.pendingMessageId
    this.setData({ sending: true, error: '' })
    try {
      const message = await supportService.send(this.data.conversationId, {
        clientMessageId,
        content,
        orderNo: this.data.orderNo || undefined,
      })
      if (this.pendingMessageId !== clientMessageId) return
      const known = this.data.messages.some((item) => item.id === message.id)
      const messages = known
        ? this.data.messages
        : [...this.data.messages, presentMessage(message)]
      this.pendingMessageId = ''
      this.pendingContent = ''
      this.setData({
        messages,
        draft: '',
        scrollIntoView: `message-${message.id}`,
      })
    } catch (error) {
      this.setData({ error: error instanceof Error ? error.message : '发送失败，请重试' })
    } finally {
      this.setData({ sending: false })
    }
  },

  onRetry() {
    void this.initialize()
  },
})
