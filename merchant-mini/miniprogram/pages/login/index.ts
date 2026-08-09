import { merchantAuthService } from '../../services/auth'

const readableError = (error: unknown): string =>
  error instanceof Error ? error.message : '登录失败，请重试'

Page({
  data: {
    username: '',
    password: '',
    confirmed: false,
    showBinding: false,
    isLoading: false,
    errorMessage: '',
  },

  onLoad() {
    void this.loginWithWechat()
  },

  async loginWithWechat() {
    if (this.data.isLoading) return
    this.setData({ isLoading: true, errorMessage: '' })
    try {
      await merchantAuthService.resumeOrLogin()
      wx.reLaunch({ url: '/pages/profile/index' })
    } catch (error) {
      if (merchantAuthService.requiresPasswordBinding(error)) {
        this.setData({
          showBinding: true,
          errorMessage: '当前微信尚未绑定员工账号，请使用账号密码完成绑定。',
        })
      } else {
        this.setData({ errorMessage: `${readableError(error)}，请点击重试。` })
      }
    } finally {
      this.setData({ isLoading: false })
    }
  },

  onUsernameChange(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ username: event.detail.value, errorMessage: '' })
  },

  onPasswordChange(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ password: event.detail.value, errorMessage: '' })
  },

  onConfirmationChange(event: WechatMiniprogram.CustomEvent<{ value: string[] }>) {
    this.setData({ confirmed: event.detail.value.includes('confirmed'), errorMessage: '' })
  },

  async loginWithPassword() {
    if (this.data.isLoading) return
    const { username, password, confirmed } = this.data
    if (!username.trim() || !password) {
      this.setData({ errorMessage: '请填写员工账号和密码。' })
      return
    }
    if (!confirmed) {
      this.setData({ errorMessage: '请先确认将当前微信绑定到此员工账号。' })
      return
    }

    this.setData({ isLoading: true, errorMessage: '' })
    try {
      await merchantAuthService.loginWithPassword(username.trim(), password, confirmed)
      wx.reLaunch({ url: '/pages/profile/index' })
    } catch (error) {
      this.setData({ errorMessage: `${readableError(error)}，请检查后重试。` })
    } finally {
      this.setData({ isLoading: false })
    }
  },
})
