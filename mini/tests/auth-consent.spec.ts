import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const { loginWithWechat } = vi.hoisted(() => ({
  loginWithWechat: vi.fn(),
}))

vi.mock('../miniprogram/services/auth', () => ({
  authService: {
    loginWithWechat,
  },
}))

type AuthPageOptions = {
  data: {
    agreed: boolean
    loading: boolean
    error: string
  }
  onAuthorize(): Promise<void>
}

let authPage: AuthPageOptions

beforeAll(async () => {
  ;(globalThis as unknown as { Page: typeof Page }).Page = ((
    options: AuthPageOptions,
  ) => {
    authPage = options
  }) as unknown as typeof Page
  ;(
    globalThis as unknown as {
      getCurrentPages: typeof getCurrentPages
    }
  ).getCurrentPages = vi.fn(() => [{}, {}]) as unknown as typeof getCurrentPages
  ;(globalThis as unknown as { wx: WechatMiniprogram.Wx }).wx = {
    showToast: vi.fn(),
    navigateBack: vi.fn(),
    reLaunch: vi.fn(),
  } as unknown as WechatMiniprogram.Wx

  await import('../miniprogram/pages/auth/index')
})

beforeEach(() => {
  loginWithWechat.mockReset()
  loginWithWechat.mockResolvedValue({})
})

describe('authorization consent', () => {
  it('blocks WeChat login until the customer agrees to both documents', async () => {
    const context = {
      data: {
        agreed: false,
        loading: false,
        error: '',
      },
      setData: vi.fn(),
    }

    await authPage.onAuthorize.call(context)

    expect(loginWithWechat).not.toHaveBeenCalled()
    expect(context.setData).toHaveBeenCalledWith({
      error: '请先阅读并同意《用户服务协议》和《隐私政策》',
    })
  })
})
