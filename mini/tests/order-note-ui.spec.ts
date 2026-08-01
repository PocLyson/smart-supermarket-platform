import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('order note UI', () => {
  it('renders an optional 100-character checkout note card', () => {
    const markup = readFileSync(
      resolve(__dirname, '../miniprogram/pages/checkout/index.wxml'),
      'utf8',
    )

    expect(markup).toContain('订单备注')
    expect(markup).toContain('maxlength="100"')
    expect(markup).toContain('{{customerNoteCount}} / 100')
    expect(markup).toContain('bindinput="onCustomerNoteInput"')
  })

  it('renders the note only in order detail', () => {
    const markup = readFileSync(
      resolve(__dirname, '../miniprogram/pages/order-detail/index.wxml'),
      'utf8',
    )

    expect(markup).toContain('wx:if="{{order.customerNote}}"')
    expect(markup).toContain('{{order.customerNote}}')
  })
})
