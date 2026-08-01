import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const { submit, updateContact, updateCustomerNote } = vi.hoisted(() => ({
  submit: vi.fn(),
  updateContact: vi.fn(),
  updateCustomerNote: vi.fn(),
}))

vi.mock('../miniprogram/services/auth', () => ({
  profileService: { get: vi.fn() },
}))
vi.mock('../miniprogram/store/checkout', () => ({
  checkout: {
    updateContact,
    updateCustomerNote,
    submit,
  },
}))
vi.mock('../miniprogram/store/cart', () => ({
  cart: {
    selectedItems: vi.fn(() => []),
    selectedTotalCent: vi.fn(() => 0),
  },
}))
vi.mock('../miniprogram/pages/checkout/presentation', () => ({
  validateCheckoutFields: vi.fn(() => ({
    pickupNameError: '',
    phoneError: '',
  })),
}))
vi.mock('../miniprogram/utils/money', () => ({
  formatMoney: vi.fn(() => '0.00'),
}))

type CheckoutPage = {
  onLoad?: () => void
  onSubmit(): Promise<void>
  onCustomerNoteInput(event: WechatMiniprogram.Input): void
}

let checkoutPage: CheckoutPage

beforeAll(async () => {
  ;(globalThis as unknown as { Page: typeof Page }).Page = ((
    options: CheckoutPage,
  ) => {
    checkoutPage = options
  }) as unknown as typeof Page
  await import('../miniprogram/pages/checkout/index')
})

beforeEach(() => {
  submit.mockReset()
  updateContact.mockClear()
  updateCustomerNote.mockClear()
  vi.stubGlobal('wx', {
    redirectTo: vi.fn(),
    showToast: vi.fn(),
  })
})

describe('checkout note page', () => {
  it('starts every new page with a blank note draft', () => {
    const setData = vi.fn()

    expect(checkoutPage.onLoad).toBeTypeOf('function')
    checkoutPage.onLoad?.call({ setData })

    expect(setData).toHaveBeenCalledWith({
      customerNote: '',
      customerNoteCount: 0,
      customerNoteError: '',
    })
    expect(updateCustomerNote).toHaveBeenCalledWith('')
  })

  it('counts effective characters while preserving the raw draft', () => {
    const setData = vi.fn()
    const note = '备'.repeat(100)
    const rawNote = `  ${note}  `

    checkoutPage.onCustomerNoteInput.call(
      { setData },
      { detail: { value: rawNote } } as WechatMiniprogram.Input,
    )

    expect(setData).toHaveBeenCalledWith({
      customerNote: rawNote,
      customerNoteCount: 100,
      customerNoteError: '',
    })
    expect(updateCustomerNote).toHaveBeenCalledWith(rawNote)
  })

  it('shows an explicit error for one hundred and one effective characters', () => {
    const setData = vi.fn()
    const rawNote = `  ${'备'.repeat(101)}  `

    checkoutPage.onCustomerNoteInput.call(
      { setData },
      { detail: { value: rawNote } } as WechatMiniprogram.Input,
    )

    expect(setData).toHaveBeenCalledWith({
      customerNote: rawNote,
      customerNoteCount: 101,
      customerNoteError: '订单备注不能超过 100 个字符',
    })
    expect(updateCustomerNote).toHaveBeenCalledWith(rawNote)
  })

  it('shows the stale-cart rejection unchanged in the banner and toast', async () => {
    const message = '部分商品已下架，请移除后重试'
    submit.mockRejectedValueOnce(new Error(message))
    const context = {
      data: {
        pickupName: '李先生',
        phone: '13800138000',
        pickupReady: true,
        submitting: false,
        error: '',
      },
      setData(update: Record<string, unknown>) {
        Object.assign(this.data, update)
      },
      onEditPickup: vi.fn(),
    }
    const setData = vi.spyOn(context, 'setData')

    await checkoutPage.onSubmit.call(context)

    expect(updateContact).toHaveBeenCalledWith({
      pickupName: '李先生',
      phone: '13800138000',
    })
    expect(setData).toHaveBeenCalledWith({ error: message })
    expect(context.data.error).toBe(message)
    expect(wx.showToast).toHaveBeenCalledWith({ title: message, icon: 'none' })
    expect(wx.redirectTo).not.toHaveBeenCalled()
  })
})
