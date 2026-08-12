import { merchantSupportService } from '../../services/support'
import { merchantSessionStore } from '../../store/session'
import type { MerchantSupportMessage } from '../../types/support'

type PresentedMessage = MerchantSupportMessage & { isMine: boolean; displayTime: string }
const present = (item: MerchantSupportMessage): PresentedMessage => ({
  ...item,
  isMine: item.senderType === 'MERCHANT',
  displayTime: item.createdAt ? item.createdAt.replace('T', ' ').slice(5, 16) : '',
})
const messageId = () => `merchant-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

Page({
  data: {
    conversationId: 0,
    displayName: '顾客',
    maskedPhone: '',
    orderNo: '',
    messages: [] as PresentedMessage[],
    draft: '',
    loading: true,
    sending: false,
    errorMessage: '',
    scrollIntoView: '',
  },
  timer: undefined as ReturnType<typeof setInterval> | undefined,
  generation: 0,
  inFlightGeneration: -1,
  pendingMessageId: '',
  pendingContent: '',

  onLoad(query: Record<string, string | undefined>) {
    const conversationId = Number(query.id)
    if (!Number.isSafeInteger(conversationId) || conversationId <= 0) {
      this.setData({ loading: false, errorMessage: '会话参数无效' })
      return
    }
    this.setData({
      conversationId,
      displayName: query.name ? decodeURIComponent(query.name) : '顾客',
      maskedPhone: query.phone ? decodeURIComponent(query.phone) : '',
      orderNo: query.orderNo ? decodeURIComponent(query.orderNo) : '',
    })
  },

  onShow() {
    if (!merchantSessionStore.current()) {
      wx.reLaunch({ url: '/pages/login/index' })
      return
    }
    if (!this.data.conversationId) return
    this.startPolling()
  },
  onHide() { this.stopPolling() },
  onUnload() { this.stopPolling() },

  startPolling() {
    this.stopPolling()
    this.generation += 1
    const generation = this.generation
    void this.loadMessages(false, generation)
    this.timer = setInterval(() => void this.loadMessages(true, generation), 10_000)
  },
  stopPolling() {
    this.generation += 1
    if (this.timer) clearInterval(this.timer)
    this.timer = undefined
  },

  async loadMessages(quiet: boolean, generation: number) {
    if (this.inFlightGeneration === generation) return
    this.inFlightGeneration = generation
    const afterId = quiet ? this.data.messages[this.data.messages.length - 1]?.id || 0 : 0
    try {
      const incoming = await merchantSupportService.messages(this.data.conversationId, afterId)
      if (generation !== this.generation) return
      const known = new Set(this.data.messages.map((item) => item.id))
      const messages = quiet
        ? [...this.data.messages, ...incoming.filter((item) => !known.has(item.id)).map(present)]
        : incoming.map(present)
      this.setData({
        messages,
        loading: false,
        errorMessage: '',
        scrollIntoView: messages.length ? `message-${messages[messages.length - 1].id}` : '',
      })
      const latestCustomer = [...incoming].reverse().find((item) => item.senderType === 'CUSTOMER')
      if (latestCustomer) await merchantSupportService.markRead(this.data.conversationId, latestCustomer.id)
    } catch (error) {
      if (generation !== this.generation || quiet) return
      this.setData({ loading: false, errorMessage: error instanceof Error ? error.message : '消息加载失败' })
    } finally {
      if (this.inFlightGeneration === generation) this.inFlightGeneration = -1
    }
  },

  onDraftInput(event: WechatMiniprogram.Input) {
    const draft = String(event.detail.value || '')
    if (draft.trim() !== this.pendingContent) {
      this.pendingMessageId = ''
      this.pendingContent = ''
    }
    this.setData({ draft, errorMessage: '' })
  },

  async onReply() {
    const content = this.data.draft.trim()
    if (!content || this.data.sending) return
    if (!this.pendingMessageId || this.pendingContent !== content) {
      this.pendingMessageId = messageId()
      this.pendingContent = content
    }
    const clientMessageId = this.pendingMessageId
    this.setData({ sending: true, errorMessage: '' })
    try {
      const reply = await merchantSupportService.reply(this.data.conversationId, {
        clientMessageId,
        content,
        orderNo: this.data.orderNo || undefined,
      })
      if (this.pendingMessageId !== clientMessageId) return
      const messages = this.data.messages.some((item) => item.id === reply.id)
        ? this.data.messages
        : [...this.data.messages, present(reply)]
      this.pendingMessageId = ''
      this.pendingContent = ''
      this.setData({ messages, draft: '', scrollIntoView: `message-${reply.id}` })
    } catch (error) {
      this.setData({ errorMessage: error instanceof Error ? error.message : '回复失败，请重试' })
    } finally {
      this.setData({ sending: false })
    }
  },

  goBack() { wx.navigateBack() },
  retry() { void this.loadMessages(false, this.generation) },
})
