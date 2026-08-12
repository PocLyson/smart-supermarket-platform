import { sessionStore, type SessionStore } from '../store/session'
import type {
  SendSupportMessageRequest,
  SupportConversation,
  SupportMessage,
} from '../types/support'
import { http, type HttpClient } from './http'

type SupportHttp = Pick<HttpClient, 'get' | 'post'>

const authHeaders = (session: SessionStore): Record<string, string> => {
  const current = session.current()
  if (!current) throw new Error('请先登录')
  return { Authorization: `Bearer ${current.accessToken}` }
}

export const createSupportService = (client: SupportHttp, session: SessionStore) => ({
  open: (orderNo?: string): Promise<SupportConversation> =>
    client.post<SupportConversation>(
      '/api/mini/support/conversations',
      { orderNo: orderNo || undefined },
      authHeaders(session),
    ),
  messages: (conversationId: number, afterId = 0): Promise<SupportMessage[]> =>
    client.get<SupportMessage[]>(
      `/api/mini/support/conversations/${conversationId}/messages`,
      { afterId, size: 50 },
      authHeaders(session),
      { silentError: true },
    ),
  send: (
    conversationId: number,
    request: SendSupportMessageRequest,
  ): Promise<SupportMessage> =>
    client.post<SupportMessage>(
      `/api/mini/support/conversations/${conversationId}/messages`,
      request,
      authHeaders(session),
      { silentError: true },
    ),
  markRead: (conversationId: number, lastMessageId: number): Promise<SupportConversation> =>
    client.post<SupportConversation>(
      `/api/mini/support/conversations/${conversationId}/read`,
      { lastMessageId },
      authHeaders(session),
      { silentError: true },
    ),
})

export const supportService = createSupportService(http, sessionStore)
