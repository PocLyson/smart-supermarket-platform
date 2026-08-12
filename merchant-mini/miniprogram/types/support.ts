export type SupportSenderType = 'CUSTOMER' | 'MERCHANT'

export interface MerchantSupportConversation {
  id: number
  displayName: string
  maskedPhone: string
  lastRelatedOrderNo?: string | null
  lastMessagePreview?: string | null
  lastMessageAt?: string | null
  unreadCount: number
}

export interface MerchantSupportConversationPage {
  items: MerchantSupportConversation[]
  total: number
  page: number
  size: number
}

export interface MerchantSupportMessage {
  id: number
  senderType: SupportSenderType
  content: string
  orderNo?: string | null
  createdAt: string
}

export interface MerchantSupportReplyRequest {
  clientMessageId: string
  content: string
  orderNo?: string
}
