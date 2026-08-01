import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import InventoryView from '@/views/inventory/InventoryView.vue'
import * as inventoryApi from '@/api/inventory'

vi.mock('@/api/catalog', () => ({
  listCategories: vi.fn().mockResolvedValue([
    { id: 1, name: '酒水饮料', sortOrder: 1, enabled: true },
    { id: 2, name: '休闲零食', sortOrder: 2, enabled: true },
  ]),
}))

vi.mock('@/api/inventory', () => ({
  listInventory: vi.fn().mockResolvedValue({
    items: [
      {
        productId: 1,
        productName: '纯牛奶',
        categoryId: 1,
        categoryName: '酒水饮料',
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
  it('renders inventory as cards for narrow screens', async () => {
    const wrapper = mount(InventoryView)
    await flushPromises()

    expect(wrapper.find('[data-test="inventory-mobile-list"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('纯牛奶')
  })

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

  it('requests inventory by category and out-of-stock status', async () => {
    const wrapper = mount(InventoryView)
    await flushPromises()

    await wrapper.get('[data-test="inventory-category"]').setValue('1')
    await flushPromises()
    await wrapper.get('[data-test="inventory-stock-status"]').setValue('OUT_OF_STOCK')
    await flushPromises()

    expect(inventoryApi.listInventory).toHaveBeenLastCalledWith({
      categoryId: 1,
      stockStatus: 'OUT_OF_STOCK',
    })
  })
})
