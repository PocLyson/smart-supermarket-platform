import { afterEach, describe, expect, it, vi } from 'vitest'

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
})
