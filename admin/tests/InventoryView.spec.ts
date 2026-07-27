import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import InventoryView from '@/views/inventory/InventoryView.vue'
import * as inventoryApi from '@/api/inventory'

vi.mock('@/api/inventory', () => ({
  listInventory: vi.fn().mockResolvedValue({
    items: [
      {
        productId: 1,
        productName: '纯牛奶',
        availableQuantity: 10,
        unit: '盒',
        updatedAt: '2026-07-28T10:00:00Z',
      },
    ],
    page: 0,
    size: 20,
    total: 1,
  }),
  adjustInventory: vi.fn().mockResolvedValue(undefined),
}))

describe('InventoryView', () => {
  it('submits stock adjustment in whole units', async () => {
    const wrapper = mount(InventoryView)
    await flushPromises()

    await wrapper.get('[data-test="adjust-1"]').trigger('click')
    await wrapper.get('[data-test="adjust-delta"]').setValue('5')
    await wrapper.get('[data-test="adjust-reason"]').setValue('首批线上库存')
    await wrapper.get('[data-test="adjust-submit"]').trigger('click')
    await flushPromises()

    expect(inventoryApi.adjustInventory).toHaveBeenCalledWith(1, {
      delta: 5,
      reason: '首批线上库存',
    })
  })
})
