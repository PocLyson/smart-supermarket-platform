import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import AuditLogView from '@/views/audit/AuditLogView.vue'
import * as auditApi from '@/api/audit'

vi.mock('@/api/audit', () => ({
  listAuditLogs: vi.fn().mockResolvedValue({
    items: [
      {
        actorId: 1,
        actorType: 'STAFF',
        action: 'PRODUCT_UPDATE',
        objectType: 'PRODUCT',
        objectId: '1',
        resultSummary: '更新商品',
        requestId: 'req-1',
        createdAt: '2026-07-28T10:00:00Z',
      },
    ],
    page: 0,
    size: 20,
    total: 1,
  }),
}))

describe('AuditLogView', () => {
  it('renders audit records as cards for narrow screens', async () => {
    const wrapper = mount(AuditLogView)
    await flushPromises()

    expect(wrapper.find('[data-test="audit-mobile-list"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('更新商品')
  })

  it('filters audit records by actor, action, and object type', async () => {
    const wrapper = mount(AuditLogView)
    await flushPromises()

    await wrapper.get('[data-test="audit-actor"]').setValue('1')
    await wrapper.get('[data-test="audit-action"]').setValue('PRODUCT_UPDATE')
    await wrapper.get('[data-test="audit-object-type"]').setValue('PRODUCT')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(auditApi.listAuditLogs).toHaveBeenLastCalledWith({
      actorId: 1,
      action: 'PRODUCT_UPDATE',
      objectType: 'PRODUCT',
      page: 0,
      size: 20,
    })
    expect(wrapper.text()).toContain('req-1')
    expect(wrapper.text()).toContain('员工 #1')
    expect(wrapper.text()).toContain('更新商品')
    expect(wrapper.text()).toContain('商品 · 1')
  })
})
