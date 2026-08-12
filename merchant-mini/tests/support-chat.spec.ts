import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { createMerchantSupportService } from '../miniprogram/services/support'
import { NAV_ITEMS } from '../miniprogram/components/app-tab-bar/navigation'

const root = resolve(__dirname, '..', 'miniprogram')
const read = (path: string) => readFileSync(resolve(root, path), 'utf8')

describe('merchant support service', () => {
  it('uses protected conversation, message, reply, and read endpoints', async () => {
    const client = {
      get: vi.fn().mockResolvedValue({ content: [] }),
      post: vi.fn().mockResolvedValue({ id: 1 }),
    }
    const service = createMerchantSupportService(client)

    await service.list(0, 20)
    await service.messages(4, 9)
    await service.reply(4, {
      clientMessageId: 'merchant-1',
      content: '可以取货了',
      orderNo: 'ORDER-1',
    })
    await service.markRead(4, 10)

    expect(client.get).toHaveBeenNthCalledWith(1, '/api/merchant-mini/support/conversations', { page: 0, size: 20 })
    expect(client.get).toHaveBeenNthCalledWith(2, '/api/merchant-mini/support/conversations/4/messages', { afterId: 9, size: 50 })
    expect(client.post).toHaveBeenNthCalledWith(1, '/api/merchant-mini/support/conversations/4/messages', expect.objectContaining({ clientMessageId: 'merchant-1' }))
    expect(client.post).toHaveBeenNthCalledWith(2, '/api/merchant-mini/support/conversations/4/read', { lastMessageId: 10 })
  })
})

describe('merchant message center contract', () => {
  it('routes the message tab to the real inbox and registers detail artifacts', () => {
    expect(NAV_ITEMS.find((item) => item.id === 'messages')?.url).toBe('/pages/messages/index')
    const app = JSON.parse(read('app.json')) as { pages: string[] }
    for (const page of ['pages/messages/index', 'pages/message-detail/index']) {
      expect(app.pages).toContain(page)
      for (const extension of ['ts', 'wxml', 'wxss', 'json']) {
        expect(existsSync(resolve(root, `${page}.${extension}`))).toBe(true)
      }
    }
  })

  it('shows masked customer context, unread badges, errors, and safe reply controls', () => {
    const inbox = read('pages/messages/index.wxml')
    const detail = read('pages/message-detail/index.wxml')
    const style = read('pages/message-detail/index.wxss')

    expect(inbox).toContain('{{item.displayName}}')
    expect(inbox).toContain('{{item.maskedPhone}}')
    expect(inbox).toContain('wx:if="{{item.unreadCount > 0}}"')
    expect(inbox).toContain('bindtap="onOpenConversation"')
    expect(detail).toContain('maxlength="500"')
    expect(detail).toContain('bindtap="onReply"')
    expect(detail).toContain('订单 {{item.orderNo}}')
    expect(style).toContain('env(safe-area-inset-bottom)')
    expect(style).toContain('min-height: 88rpx')
  })

  it('lets the workbench waiting metric open the inbox', () => {
    expect(read('pages/workbench/index.wxml')).toContain('bindtap="onMessagesTap"')
    expect(read('pages/workbench/index.ts')).toContain("'/pages/messages/index'")
  })
})
