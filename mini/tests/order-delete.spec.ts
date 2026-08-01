import { describe, expect, it, vi } from 'vitest'
import { createOrdersService } from '../miniprogram/services/orders'
import type { HttpClient } from '../miniprogram/services/http'
import type { SessionStore } from '../miniprogram/store/session'

describe('customer order deletion', () => {
  it('lets checkout own create-order error presentation', async () => {
    const client = {
      post: vi.fn().mockResolvedValue({ orderNo: 'ORDER-001' }),
    } as unknown as Pick<HttpClient, 'get' | 'post' | 'delete'>
    const session = {
      current: () => ({ accessToken: 'customer-token' }),
    } as SessionStore
    const service = createOrdersService(client, session)
    const request = {
      pickupName: '李先生',
      phone: '13800138000',
      items: [{ productId: 1, quantity: 1 }],
    }

    await service.create('idempotency-key', request)

    expect(client.post).toHaveBeenCalledWith(
      '/api/mini/orders',
      request,
      {
        Authorization: 'Bearer customer-token',
        'Idempotency-Key': 'idempotency-key',
      },
      { silentError: true },
    )
  })

  it('exposes an authenticated delete operation for a customer order', async () => {
    const client = {
      delete: vi.fn().mockResolvedValue({ deleted: true }),
    } as unknown as Pick<HttpClient, 'get' | 'post' | 'delete'>
    const session = {
      current: () => ({ accessToken: 'customer-token' }),
    } as SessionStore
    const service = createOrdersService(client, session) as ReturnType<
      typeof createOrdersService
    > & {
      remove?: (orderNo: string) => Promise<{ deleted: boolean }>
    }

    expect(typeof service.remove).toBe('function')
    await expect(service.remove?.('ORDER/001')).resolves.toEqual({ deleted: true })
    expect(client.delete).toHaveBeenCalledWith(
      '/api/mini/orders/ORDER%2F001',
      undefined,
      { Authorization: 'Bearer customer-token' },
    )
  })
})
