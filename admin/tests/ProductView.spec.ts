import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import ProductView from '@/views/catalog/ProductView.vue'
import ProductImageUpload from '@/components/ProductImageUpload.vue'
import { centToYuan, yuanToCent } from '@/utils/money'
import * as catalogApi from '@/api/catalog'

vi.mock('@/api/catalog', () => ({
  listCategories: vi.fn().mockResolvedValue([
    {
      id: 1,
      name: '乳品',
      sortOrder: 1,
      enabled: true,
      updatedAt: '2026-07-28T10:00:00Z',
    },
  ]),
  listProducts: vi.fn().mockResolvedValue({ items: [], page: 0, size: 20, total: 0 }),
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  setProductShelf: vi.fn(),
}))

describe('product money and editor behavior', () => {
  it('converts integer cents without floating point drift', () => {
    expect(centToYuan(590)).toBe('5.90')
    expect(yuanToCent('5.90')).toBe(590)
    expect(() => yuanToCent('5.999')).toThrow('金额格式错误')
  })

  it('submits a product with integer priceCent', async () => {
    const wrapper = mount(ProductView)
    await flushPromises()

    await wrapper.get('[data-test="product-create"]').trigger('click')
    await wrapper.get('[data-test="product-name"]').setValue('纯牛奶')
    await wrapper.get('[data-test="product-category"]').setValue('1')
    await wrapper.get('[data-test="product-price"]').setValue('5.90')
    await wrapper.get('[data-test="product-unit"]').setValue('盒')
    await wrapper.get('[data-test="product-submit"]').trigger('click')
    await flushPromises()

    expect(catalogApi.createProduct).toHaveBeenCalledWith({
      name: '纯牛奶',
      categoryId: 1,
      priceCent: 590,
      unit: '盒',
      coverImageUrl: '',
      description: '',
      onShelf: true,
    })
  })

  it('includes the uploaded image URL in the product write DTO', async () => {
    const wrapper = mount(ProductView)
    await flushPromises()

    await wrapper.get('[data-test="product-create"]').trigger('click')
    await wrapper.get('[data-test="product-name"]').setValue('纯牛奶')
    await wrapper.get('[data-test="product-category"]').setValue('1')
    await wrapper.get('[data-test="product-price"]').setValue('5.90')
    await wrapper.get('[data-test="product-unit"]').setValue('盒')
    wrapper.findComponent(ProductImageUpload).vm.$emit('update:modelValue', '/files/0b657bd4.webp')
    await wrapper.get('[data-test="product-submit"]').trigger('click')
    await flushPromises()

    expect(catalogApi.createProduct).toHaveBeenLastCalledWith(
      expect.objectContaining({ coverImageUrl: '/files/0b657bd4.webp' }),
    )
  })

  it('disables product saving while an image upload is pending', async () => {
    const wrapper = mount(ProductView)
    await flushPromises()
    await wrapper.get('[data-test="product-create"]').trigger('click')

    wrapper.findComponent(ProductImageUpload).vm.$emit('uploading-change', true)
    await wrapper.vm.$nextTick()

    expect(wrapper.get('[data-test="product-submit"]').attributes('disabled')).toBeDefined()
  })
})
