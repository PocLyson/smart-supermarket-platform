import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import UiStatePanel from '@/components/UiStatePanel.vue'
import AdminLayout from '@/layouts/AdminLayout.vue'
import ForbiddenView from '@/views/ForbiddenView.vue'
import { useAuthStore } from '@/stores/auth'

describe('admin UI system', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('renders a recoverable empty state and emits its action', async () => {
    const wrapper = mount(UiStatePanel, {
      props: {
        kind: 'empty',
        title: '暂无订单',
        description: '新订单会显示在这里。',
        actionLabel: '刷新',
      },
    })

    expect(wrapper.get('[role="status"]').text()).toContain('暂无订单')
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('action')).toHaveLength(1)
  })

  it('exposes the error state through a semantic visual class', () => {
    const wrapper = mount(UiStatePanel, {
      props: {
        kind: 'error',
        title: '订单加载失败',
        description: '请检查网络后重试。',
      },
    })

    expect(wrapper.get('[role="alert"]').classes()).toContain('is-error')
  })

  it('explains the 403 boundary and provides a recovery action', () => {
    const wrapper = mount(ForbiddenView, {
      global: {
        mocks: {
          $router: { replace: () => undefined },
        },
      },
    })

    expect(wrapper.text()).toContain('403')
    expect(wrapper.text()).toContain('返回订单管理')
  })

  it('renders the role-aware shell with order-first navigation', () => {
    const auth = useAuthStore()
    auth.setSession({
      accessToken: 'owner-token',
      role: 'OWNER',
      staffId: 1,
      username: 'owner',
    })
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/orders', component: { template: '<div />' }, meta: { title: '订单管理' } },
      ],
    })
    void router.push('/orders')
    const wrapper = mount(AdminLayout, {
      global: {
        plugins: [router],
        stubs: {
          RouterView: true,
        },
      },
    })

    const labels = wrapper.findAll('nav a').map((item) => item.text())
    expect(labels[0]).toBe('订单管理')
    expect(wrapper.text()).toContain('老板')
    expect(wrapper.text()).toContain('鲁能超市')
    expect(wrapper.text()).toContain('李老家分店管理后台')
    expect(wrapper.text()).not.toContain('智慧超市')
    expect(wrapper.get('main').attributes('id')).toBe('main-content')
  })
})
