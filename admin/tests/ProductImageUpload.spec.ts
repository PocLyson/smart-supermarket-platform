import { flushPromises, mount } from '@vue/test-utils'
import { ElUpload, type UploadRequestOptions } from 'element-plus'
import { describe, expect, it, vi } from 'vitest'
import ProductImageUpload from '@/components/ProductImageUpload.vue'
import * as imagesApi from '@/api/images'

vi.mock('@/api/images', () => ({
  uploadProductImage: vi.fn(),
}))

describe('ProductImageUpload', () => {
  it('writes the authenticated upload response URL into the product form', async () => {
    vi.mocked(imagesApi.uploadProductImage).mockResolvedValue({
      url: '/files/0b657bd4.webp',
      width: 800,
      height: 800,
      size: 204800,
    })
    const wrapper = mount(ProductImageUpload, { props: { modelValue: '' } })
    const file = new File(['image'], 'milk.webp', { type: 'image/webp' })
    const upload = wrapper.findComponent(ElUpload)
    const httpRequest = upload.props('httpRequest')

    expect(httpRequest).toBeTypeOf('function')
    await httpRequest!({
      file,
      onSuccess: vi.fn(),
      onError: vi.fn(),
    } as unknown as UploadRequestOptions)
    await flushPromises()

    expect(imagesApi.uploadProductImage).toHaveBeenCalledWith(file)
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['/files/0b657bd4.webp'])
  })
})
