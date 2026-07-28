import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildSearchUrl } from '../miniprogram/pages/search/presentation'

describe('home search interactions', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('clears the keyword and refreshes the product list in one action', async () => {
    let pageDefinition: Record<string, unknown> | undefined
    vi.stubGlobal('Page', (definition: Record<string, unknown>) => {
      pageDefinition = definition
    })

    await import('../miniprogram/pages/home/index')

    const setData = vi.fn()
    const loadProducts = vi.fn()
    const onClearSearch = pageDefinition?.onClearSearch as
      | ((this: unknown) => void)
      | undefined

    expect(onClearSearch).toBeTypeOf('function')
    onClearSearch?.call({ setData, loadProducts })

    expect(setData).toHaveBeenCalledWith({ keyword: '' })
    expect(loadProducts).toHaveBeenCalledWith(true)
  })

  it('opens a dedicated result page with a trimmed encoded keyword', () => {
    expect(buildSearchUrl('  牛奶 1L  ')).toBe(
      '/pages/search/index?keyword=%E7%89%9B%E5%A5%B6%201L',
    )
  })
})
