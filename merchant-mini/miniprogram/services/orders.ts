import type {
  MerchantOrder,
  MerchantOrderListQuery,
  MerchantOrderPage,
  PaymentMethod,
} from '../types/order'
import { merchantHttp, type MerchantHttp } from './http'

export const createOrdersService = (
  client: Pick<MerchantHttp, 'get' | 'post'>,
) => {
  const list = (query: MerchantOrderListQuery): Promise<MerchantOrderPage> =>
    client.get<MerchantOrderPage>('/api/merchant-mini/orders', query)

  return {
  list,
  listThrough: async (
    query: Omit<MerchantOrderListQuery, 'page'>,
    lastPage: number,
  ): Promise<MerchantOrderPage> => {
    const items: MerchantOrder[] = []
    let total = 0
    for (let page = 0; page <= lastPage; page += 1) {
      const result = await list({ ...query, page })
      items.push(...result.items)
      total = result.total
    }
    return { items, total, page: lastPage, size: query.size }
  },
  detail: (orderNo: string): Promise<MerchantOrder> =>
    client.get<MerchantOrder>(
      `/api/merchant-mini/orders/${encodeURIComponent(orderNo)}`,
    ),
  pickupPreview: (pickupCode: string): Promise<MerchantOrder> =>
    client.get<MerchantOrder>(
      '/api/merchant-mini/orders/pickup-preview',
      { pickupCode },
    ),
  accept: (orderNo: string): Promise<MerchantOrder> =>
    client.post<MerchantOrder>(
      `/api/merchant-mini/orders/${encodeURIComponent(orderNo)}/accept`,
    ),
  markReady: (orderNo: string): Promise<MerchantOrder> =>
    client.post<MerchantOrder>(
      `/api/merchant-mini/orders/${encodeURIComponent(orderNo)}/ready`,
    ),
  markPaid: (orderNo: string, method: PaymentMethod): Promise<MerchantOrder> =>
    client.post<MerchantOrder>(
      `/api/merchant-mini/orders/${encodeURIComponent(orderNo)}/pay`,
      { method },
    ),
  verifyPickup: (
    orderNo: string,
    pickupCode: string,
    payAtStoreMethod: PaymentMethod,
    requestId: string,
  ): Promise<MerchantOrder> =>
    client.post<MerchantOrder>(
      `/api/merchant-mini/orders/${encodeURIComponent(orderNo)}/verify-pickup`,
      { pickupCode, payAtStoreMethod },
      {
        authorization: 'protected',
        headers: { 'X-Request-Id': requestId },
      },
    ),
  cancel: (orderNo: string, reason: string): Promise<MerchantOrder> =>
    client.post<MerchantOrder>(
      `/api/merchant-mini/orders/${encodeURIComponent(orderNo)}/cancel`,
      { reason },
    ),
  }
}

export const merchantOrdersService = createOrdersService(merchantHttp)
