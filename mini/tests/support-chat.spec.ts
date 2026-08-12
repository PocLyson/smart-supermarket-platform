import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { createSupportService } from '../miniprogram/services/support'
import { createSupportPoller } from '../miniprogram/utils/support-poller'

const root = resolve(__dirname, '..', 'miniprogram')
const read = (path: string) => readFileSync(resolve(root, path), 'utf8')

describe('customer support chat service', () => {
  it('uses authenticated customer endpoints and an idempotent client message id', async () => {
    const client = {
      get: vi.fn().mockResolvedValue([]),
      post: vi.fn().mockResolvedValue({ id: 1 }),
    }
    const session = {
      current: vi.fn().mockReturnValue({ accessToken: 'customer-token' }),
      save: vi.fn(),
      clear: vi.fn(),
    }
    const service = createSupportService(client, session)

    await service.open('ORDER-1')
    await service.messages(9, 18)
    await service.send(9, {
      clientMessageId: 'customer-1',
      content: '请问几点可以取货？',
      orderNo: 'ORDER-1',
    })
    await service.markRead(9, 23)

    const headers = { Authorization: 'Bearer customer-token' }
    expect(client.post).toHaveBeenNthCalledWith(
      1,
      '/api/mini/support/conversations',
      { orderNo: 'ORDER-1' },
      headers,
    )
    expect(client.get).toHaveBeenCalledWith(
      '/api/mini/support/conversations/9/messages',
      { afterId: 18, size: 50 },
      headers,
      { silentError: true },
    )
    expect(client.post).toHaveBeenNthCalledWith(
      2,
      '/api/mini/support/conversations/9/messages',
      expect.objectContaining({ clientMessageId: 'customer-1' }),
      headers,
      { silentError: true },
    )
    expect(client.post).toHaveBeenNthCalledWith(
      3,
      '/api/mini/support/conversations/9/read',
      { lastMessageId: 23 },
      headers,
      { silentError: true },
    )
  })
})

describe('support polling lifecycle', () => {
  it('polls at most once at a time and stops while hidden', async () => {
    let finish: (() => void) | undefined
    const poll = vi.fn(() => new Promise<void>((resolve) => { finish = resolve }))
    const schedule = vi.fn(() => 7 as unknown as ReturnType<typeof setTimeout>)
    const cancel = vi.fn()
    const controller = createSupportPoller({ poll, schedule, cancel, intervalMs: 10_000 })

    controller.start()
    controller.start()
    expect(poll).toHaveBeenCalledTimes(1)
    controller.stop()
    finish?.()
    await Promise.resolve()
    expect(schedule).not.toHaveBeenCalled()
    expect(cancel).toHaveBeenCalled()
  })

  it('continues polling after a hide-show race while the old request is pending', async () => {
    let finish: (() => void) | undefined
    const poll = vi.fn(() => new Promise<void>((resolve) => { finish = resolve }))
    const schedule = vi.fn(() => 8 as unknown as ReturnType<typeof setTimeout>)
    const controller = createSupportPoller({
      poll,
      schedule,
      cancel: vi.fn(),
      intervalMs: 10_000,
    })

    controller.start()
    controller.stop()
    controller.start()
    finish?.()
    await Promise.resolve()

    expect(poll).toHaveBeenCalledTimes(1)
    expect(schedule).toHaveBeenCalledTimes(1)
  })
})

describe('customer support chat page contract', () => {
  it('registers a navy chat page with accessible messages and safe-area composer', () => {
    const app = JSON.parse(read('app.json')) as { pages: string[] }
    const markup = read('pages/support-chat/index.wxml')
    const style = read('pages/support-chat/index.wxss')

    expect(app.pages).toContain('pages/support-chat/index')
    expect(markup).toContain('scroll-into-view="{{scrollIntoView}}"')
    expect(markup).toContain('maxlength="500"')
    expect(markup).toContain('bindtap="onSend"')
    expect(markup).toContain('订单 {{item.orderNo}}')
    expect(style).toContain('var(--primary-600)')
    expect(style).toContain('env(safe-area-inset-bottom)')
    expect(style).toContain('min-height: 88rpx')
  })

  it('replaces native contact buttons with the authenticated self-built chat entry', () => {
    for (const page of ['pages/profile/index.wxml', 'pages/order-detail/index.wxml']) {
      const markup = read(page)
      expect(markup).not.toContain('open-type="contact"')
      expect(markup).toContain('bindtap="onContactStore"')
    }
    expect(read('pages/order-detail/index.ts')).toContain(
      "orderNo=${encodeURIComponent(this.data.orderNo)}",
    )
  })
})
