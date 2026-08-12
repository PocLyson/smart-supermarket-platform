import type {
  MerchantSupportConversation,
  MerchantSupportConversationPage,
  MerchantSupportMessage,
  MerchantSupportReplyRequest,
} from '../types/support'
import { merchantHttp, type MerchantHttp } from './http'

type SupportHttp = Pick<MerchantHttp, 'get' | 'post'>

export const createMerchantSupportService = (client: SupportHttp) => ({
  list: (page = 0, size = 20): Promise<MerchantSupportConversationPage> =>
    client.get<MerchantSupportConversationPage>(
      '/api/merchant-mini/support/conversations',
      { page, size },
    ),
  messages: (conversationId: number, afterId = 0): Promise<MerchantSupportMessage[]> =>
    client.get<MerchantSupportMessage[]>(
      `/api/merchant-mini/support/conversations/${conversationId}/messages`,
      { afterId, size: 50 },
    ),
  reply: (
    conversationId: number,
    request: MerchantSupportReplyRequest,
  ): Promise<MerchantSupportMessage> =>
    client.post<MerchantSupportMessage>(
      `/api/merchant-mini/support/conversations/${conversationId}/messages`,
      request,
    ),
  markRead: (
    conversationId: number,
    lastMessageId: number,
  ): Promise<MerchantSupportConversation> =>
    client.post<MerchantSupportConversation>(
      `/api/merchant-mini/support/conversations/${conversationId}/read`,
      { lastMessageId },
    ),
})

export const merchantSupportService = createMerchantSupportService(merchantHttp)
