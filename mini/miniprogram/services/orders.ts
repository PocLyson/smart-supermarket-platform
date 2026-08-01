import { sessionStore, type SessionStore } from '../store/session'
import type {
  CreateOrderRequest,
  CustomerOrder,
  OrderPage,
} from '../types/order'
import { http, type HttpClient } from './http'

const authHeaders = (
  session: SessionStore,
  extra: Record<string, string> = {},
): Record<string, string> => {
  const current = session.current()
  if (!current) throw new Error('请先登录')
  return {
    Authorization: `Bearer ${current.accessToken}`,
    ...extra,
  }
}

export const createOrdersService = (
  client: Pick<HttpClient, 'get' | 'post' | 'delete'>,
  session: SessionStore,
) => ({
  create: (
    idempotencyKey: string,
    request: CreateOrderRequest,
  ): Promise<CustomerOrder> =>
    client.post<CustomerOrder>('/api/mini/orders', request, {
      ...authHeaders(session),
      'Idempotency-Key': idempotencyKey,
    }, { silentError: true }),
  list: (query: { page: number; size: number }): Promise<OrderPage> =>
    client.get<OrderPage>(
      '/api/mini/orders',
      query,
      authHeaders(session),
    ),
  detail: (orderNo: string): Promise<CustomerOrder> =>
    client.get<CustomerOrder>(
      `/api/mini/orders/${encodeURIComponent(orderNo)}`,
      undefined,
      authHeaders(session),
    ),
  cancel: (orderNo: string): Promise<CustomerOrder> =>
    client.post<CustomerOrder>(
      `/api/mini/orders/${encodeURIComponent(orderNo)}/cancel`,
      undefined,
      authHeaders(session),
    ),
  remove: (orderNo: string): Promise<{ deleted: boolean }> =>
    client.delete<{ deleted: boolean }>(
      `/api/mini/orders/${encodeURIComponent(orderNo)}`,
      undefined,
      authHeaders(session),
    ),
})

export const ordersService = createOrdersService(http, sessionStore)
