import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LoginView from '@/views/LoginView.vue'
import * as authApi from '@/api/auth'

vi.mock('vue-router', () => ({
  useRouter: () => ({ replace: vi.fn() }),
}))

vi.mock('@/api/auth', () => ({
  login: vi.fn(),
}))

describe('LoginView', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('blocks submission until username and password are present', async () => {
    const wrapper = mount(LoginView)

    expect(wrapper.text()).toContain('鲁能超市李老家分店')
    expect(wrapper.text()).not.toContain('智慧超市')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.text()).toContain('请输入用户名')
    expect(wrapper.text()).toContain('请输入密码')
    expect(authApi.login).not.toHaveBeenCalled()
  })

  it('stores the authenticated staff session after successful login', async () => {
    vi.mocked(authApi.login).mockResolvedValue({
      accessToken: 'owner-token',
      role: 'OWNER',
      staffId: 1,
      username: 'owner',
    })
    const wrapper = mount(LoginView)

    await wrapper.get('[data-test="login-username"]').setValue('owner')
    await wrapper.get('[data-test="login-password"]').setValue('correct-password')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(localStorage.getItem('smart-store-admin-session')).toContain('owner-token')
  })

  it('lets staff verify the password they entered', async () => {
    const wrapper = mount(LoginView)
    const password = wrapper.get('[data-test="login-password"]')

    expect(password.attributes('type')).toBe('password')
    await wrapper.get('[data-test="password-toggle"]').trigger('click')
    expect(password.attributes('type')).toBe('text')
    expect(wrapper.get('[data-test="password-toggle"]').attributes('aria-label')).toContain('隐藏')
  })
})
