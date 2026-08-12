export type SupportSenderType = 'CUSTOMER' | 'MERCHANT'

export interface SupportConversation {
  id: number
  displayName: string
  maskedPhone: string
  lastRelatedOrderNo?: string | null
  lastMessagePreview?: string | null
  lastMessageAt?: string | null
  unreadCount: number
}

export interface SupportMessage {
  id: number
  senderType: SupportSenderType
  content: string
  orderNo?: string | null
  createdAt: string
}

export interface SendSupportMessageRequest {
  clientMessageId: string
  content: string
  orderNo?: string
}
