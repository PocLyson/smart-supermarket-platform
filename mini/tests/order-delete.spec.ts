import { describe, expect, it, vi } from 'vitest'
import { createOrdersService } from '../miniprogram/services/orders'
import type { HttpClient } from '../miniprogram/services/http'
import type { SessionStore } from '../miniprogram/store/session'

describe('customer order deletion', () => {
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
