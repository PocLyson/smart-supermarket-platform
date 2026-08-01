import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { acceptOrder, markOrderPaid, rejectOrder } from '@/api/orders'
import { createCashier, resetStaffPassword, setStaffEnabled } from '@/api/staff'
import { listAuditLogs } from '@/api/audit'
import { uploadProductImage } from '@/api/images'
import { archiveProduct, listProducts, restoreProduct } from '@/api/catalog'

const ok = (data: unknown) =>
  Promise.resolve(
    new Response(JSON.stringify({ code: 'OK', message: '成功', requestId: 'req-1', data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  )

describe('frozen admin API contract', () => {
  beforeEach(() => {
    localStorage.setItem(
      'smart-store-admin-session',
      JSON.stringify({
        accessToken: 'owner-token',
        role: 'OWNER',
        staffId: 1,
        username: 'owner',
      }),
    )
    vi.stubGlobal(
      'fetch',
      vi.fn(() => ok({})),
    )
  })

  afterEach(() => vi.unstubAllGlobals())

  it('uses the frozen order transition paths and DTOs', async () => {
    await acceptOrder('202607280001')
    await rejectOrder('202607280001', { reason: '缺货' })
    await markOrderPaid('202607280001', { method: 'WECHAT_QR' })

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      '/api/admin/orders/202607280001/accept',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      '/api/admin/orders/202607280001/reject',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ reason: '缺货' }) }),
    )
    expect(fetch).toHaveBeenNthCalledWith(
      3,
      '/api/admin/orders/202607280001/pay',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ method: 'WECHAT_QR' }),
      }),
    )
  })

  it('uses the frozen staff and audit paths', async () => {
    await createCashier({ username: 'cashier', password: 'TempPass123!' })
    await setStaffEnabled(2, false)
    await resetStaffPassword(2, { password: 'NextPass123!' })
    await listAuditLogs({
      actorId: 1,
      action: 'PRODUCT_UPDATE',
      objectType: 'PRODUCT',
      page: 0,
      size: 20,
    })

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      '/api/admin/staff',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      '/api/admin/staff/2/enabled',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ enabled: false }) }),
    )
    expect(fetch).toHaveBeenNthCalledWith(
      3,
      '/api/admin/staff/2/reset-password',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(fetch).toHaveBeenNthCalledWith(
      4,
      '/api/admin/audit-logs?actorId=1&action=PRODUCT_UPDATE&objectType=PRODUCT&page=0&size=20',
      expect.objectContaining({ headers: expect.any(Headers) }),
    )
  })

  it('uploads product images as authenticated multipart data', async () => {
    vi.mocked(fetch).mockImplementationOnce(() =>
      ok({ url: '/files/generated.webp', width: 800, height: 800, size: 204800 }),
    )
    const file = new File(['image'], 'milk.webp', { type: 'image/webp' })

    await uploadProductImage(file)

    expect(fetch).toHaveBeenCalledWith(
      '/api/admin/files/images',
      expect.objectContaining({ method: 'POST', body: expect.any(FormData) }),
    )
    const [, options] = vi.mocked(fetch).mock.calls[0]
    const headers = options?.headers as Headers
    expect(headers.get('Authorization')).toBe('Bearer owner-token')
    expect(headers.has('Content-Type')).toBe(false)
  })

  it('uses the product archive paths and archive-status query parameter', async () => {
    await listProducts({ archiveStatus: 'ARCHIVED', page: 0, size: 20 })
    await archiveProduct(10)
    await restoreProduct(10)

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      '/api/admin/products?archiveStatus=ARCHIVED&page=0&size=20',
      expect.objectContaining({ headers: expect.any(Headers) }),
    )
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      '/api/admin/products/10',
      expect.objectContaining({ method: 'DELETE' }),
    )
    expect(fetch).toHaveBeenNthCalledWith(
      3,
      '/api/admin/products/10/restore',
      expect.objectContaining({ method: 'POST' }),
    )
  })
})
