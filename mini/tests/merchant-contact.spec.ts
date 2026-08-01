import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { createStoreService } from '../miniprogram/services/store'
import {
  callStorePhone,
  EMERGENCY_STORE_PHONE,
  loadStoreContact,
} from '../miniprogram/utils/merchant-contact'

const miniRoot = resolve(__dirname, '..', 'miniprogram')

function read(relativePath: string) {
  return readFileSync(resolve(miniRoot, relativePath), 'utf8')
}

describe('merchant contact service', () => {
  it('loads the public store contact endpoint without authentication', async () => {
    const get = vi.fn().mockResolvedValue({
      phone: '18653045492',
      customerServiceEnabled: true,
    })
    const contact = createStoreService({ get })

    await expect(contact.contact()).resolves.toEqual({
      phone: '18653045492',
      customerServiceEnabled: true,
    })
    expect(get).toHaveBeenCalledWith(
      '/api/mini/store/contact',
      undefined,
      undefined,
      { silentError: true },
    )
  })

  it('keeps the emergency phone and hides online service when contact loading fails', async () => {
    await expect(
      loadStoreContact({ contact: vi.fn().mockRejectedValue(new Error('offline')) }),
    ).resolves.toEqual({
      phone: EMERGENCY_STORE_PHONE,
      customerServiceEnabled: false,
    })
  })

  it.each(['', '12345678901'])(
    'falls back and hides online service when a successful response has invalid phone %j',
    async (phone) => {
      await expect(
        loadStoreContact({
          contact: vi.fn().mockResolvedValue({
            phone,
            customerServiceEnabled: true,
          }),
        }),
      ).resolves.toEqual({
        phone: EMERGENCY_STORE_PHONE,
        customerServiceEnabled: false,
      })
    },
  )
})

describe('merchant phone helper', () => {
  it('passes the configured number to the native dialer', async () => {
    const wxApi = {
      makePhoneCall: vi.fn(({ success }) => success?.({})),
      showModal: vi.fn(),
    }

    await callStorePhone('18653045492', wxApi)

    expect(wxApi.makePhoneCall).toHaveBeenCalledWith(
      expect.objectContaining({ phoneNumber: '18653045492' }),
    )
  })

  it('shows the complete phone number when the native dialer fails', async () => {
    const wxApi = {
      makePhoneCall: vi.fn(({ fail }) => fail?.({ errMsg: 'fail' })),
      showModal: vi.fn(),
    }

    await callStorePhone('18653045492', wxApi)

    expect(wxApi.showModal).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('18653045492') }),
    )
  })
})

describe('merchant contact page markup', () => {
  it('shows profile contact actions only after customer login', () => {
    const markup = read('pages/profile/index.wxml')

    expect(markup).toContain('<view wx:if="{{loggedIn}}" class="merchant-contact-actions">')
  })

  it.each([
    'pages/profile/index.wxml',
    'pages/order-detail/index.wxml',
  ])('%s offers native online support and a phone action', (page) => {
    const markup = read(page)

    expect(markup.match(/open-type="contact"/g)).toHaveLength(1)
    expect(markup.match(/bindtap="onCallStore"/g)).toHaveLength(1)
  })
})
