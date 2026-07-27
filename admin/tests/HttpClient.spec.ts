import { afterEach, describe, expect, it, vi } from 'vitest'
import { ElMessage } from 'element-plus'
import { request } from '@/api/http'

describe('admin HTTP client', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('clears the staff session on an empty 401 response', async () => {
    window.history.pushState({}, '', '/login')
    localStorage.setItem(
      'smart-store-admin-session',
      JSON.stringify({ accessToken: 'expired-token', role: 'OWNER' }),
    )
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 401 })))

    await expect(request('/api/admin/products')).rejects.toThrow()

    expect(localStorage.getItem('smart-store-admin-session')).toBeNull()
  })

  it('shows the server message for business errors', async () => {
    const message = vi.spyOn(ElMessage, 'error').mockImplementation(() => ({ close: vi.fn() }))
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            code: 'ORDER_STATE_CONFLICT',
            message: '订单已被其他员工处理',
            requestId: 'req-conflict',
            data: null,
          }),
          { status: 409, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    )

    await expect(request('/api/admin/orders/1/accept')).rejects.toThrow('订单已被其他员工处理')

    expect(message).toHaveBeenCalledWith('订单已被其他员工处理')
  })
})
