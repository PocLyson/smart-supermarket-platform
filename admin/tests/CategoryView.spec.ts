import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import CategoryView from '@/views/catalog/CategoryView.vue'
import * as catalogApi from '@/api/catalog'

vi.mock('@/api/catalog', () => ({
  listCategories: vi.fn().mockResolvedValue([
    { id: 1, name: '乳品烘焙', sortOrder: 10, enabled: true },
    { id: 2, name: '临时分类', sortOrder: 20, enabled: false },
  ]),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
}))

describe('CategoryView', () => {
  it('filters category cards by keyword and enabled state', async () => {
    const wrapper = mount(CategoryView)
    await flushPromises()

    await wrapper.get('[data-test="category-keyword"]').setValue('临时')
    await wrapper.get('[data-test="category-status"]').setValue('disabled')

    expect(wrapper.find('[data-test="category-mobile-list"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('临时分类')
    expect(wrapper.text()).not.toContain('乳品烘焙')
    expect(catalogApi.listCategories).toHaveBeenCalledTimes(1)
  })
})
