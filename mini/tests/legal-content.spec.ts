import { beforeAll, describe, expect, it, vi } from 'vitest'

type LegalSection = {
  heading: string
  paragraphs: string[]
}

type LegalPageOptions = {
  onLoad(query: Record<string, string | undefined>): void
}

let legalPage: LegalPageOptions

beforeAll(async () => {
  ;(globalThis as unknown as { Page: typeof Page }).Page = ((
    options: LegalPageOptions,
  ) => {
    legalPage = options
  }) as unknown as typeof Page
  ;(globalThis as unknown as { wx: WechatMiniprogram.Wx }).wx = {
    setNavigationBarTitle: vi.fn(),
  } as unknown as WechatMiniprogram.Wx

  await import('../miniprogram/pages/legal/index')
})

const loadDocument = (type: 'terms' | 'privacy') => {
  const setData = vi.fn()
  legalPage.onLoad.call({ setData }, { type })
  return setData.mock.calls[0][0] as {
    title: string
    sections: LegalSection[]
  }
}

describe('legal document disclosures', () => {
  it('explains the complete customer transaction rules', () => {
    const document = loadDocument('terms')
    const headings = document.sections.map((section) => section.heading)
    const content = document.sections
      .flatMap((section) => section.paragraphs)
      .join('\n')

    expect(headings).toEqual(
      expect.arrayContaining([
        '一、协议适用与接受',
        '四、商品信息、价格与库存',
        '七、取消订单、售后与退款',
        '十一、知识产权',
        '十三、法律适用与争议解决',
      ]),
    )
    expect(content).toContain('单县新年副食门市部')
    expect(content).toContain('单县朱集镇李老家')
    expect(content).toContain('18653045492')
  })

  it('discloses the complete personal-information lifecycle', () => {
    const document = loadDocument('privacy')
    const headings = document.sections.map((section) => section.heading)
    const content = document.sections
      .flatMap((section) => section.paragraphs)
      .join('\n')

    expect(headings).toEqual(
      expect.arrayContaining([
        '二、个人信息收集与使用清单',
        '五、委托处理、共享、转让与公开披露',
        '七、你的个人信息权利',
        '八、未成年人个人信息保护',
        '九、个人信息安全事件处置',
        '十一、联系我们',
      ]),
    )
    expect(content).toContain('本地搜索记录')
    expect(content).toContain('待提交订单')
    expect(content).toContain('单县新年副食门市部')
    expect(content).toContain('单县朱集镇李老家')
    expect(content).toContain('李松')
    expect(content).toContain('18653045492')
    expect(content).toContain('lljluneng@163.com')
    expect(content).toContain('“我的”—“设置”—“注销账号”')
    expect(content).toContain('未完成订单')
    expect(content).toContain('依法必须继续保存的交易记录')
  })
})
