import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { acceptOrder, markOrderPaid, rejectOrder } from '@/api/orders'
import { createCashier, resetStaffPassword, setStaffEnabled } from '@/api/staff'
import { listAuditLogs } from '@/api/audit'

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
    await markOrderPaid('202607280001', { paymentMethod: 'WECHAT_QR' })

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
        body: JSON.stringify({ paymentMethod: 'WECHAT_QR' }),
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
})
