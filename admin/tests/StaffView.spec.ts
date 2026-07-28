import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import StaffView from '@/views/staff/StaffView.vue'
import * as staffApi from '@/api/staff'

vi.mock('@/api/staff', () => ({
  listStaff: vi.fn(),
  createCashier: vi.fn(),
  setStaffEnabled: vi.fn(),
  resetStaffPassword: vi.fn(),
}))

describe('StaffView', () => {
  beforeEach(() => {
    vi.mocked(staffApi.listStaff).mockResolvedValue([
      {
        id: 1,
        username: 'owner',
        role: 'OWNER',
        enabled: true,
        lastLoginAt: '2026-07-28T07:00:00Z',
        createdAt: '2026-07-27T08:00:00Z',
      },
      {
        id: 2,
        username: 'cashier01',
        role: 'CASHIER',
        enabled: true,
        lastLoginAt: null,
        createdAt: '2026-07-28T08:00:00Z',
        passwordHash: '$2a$10$must-not-render',
      } as staffApi.StaffAccount,
    ])
  })

  it('never renders stored password hashes', async () => {
    const wrapper = mount(StaffView)
    await flushPromises()

    expect(wrapper.text()).toContain('cashier01')
    expect(wrapper.text()).toContain('老板')
    expect(wrapper.text()).toContain('收银员')
    expect(wrapper.text()).not.toContain('OWNER')
    expect(wrapper.text()).not.toContain('CASHIER')
    expect(wrapper.text()).not.toContain('$2a$10$must-not-render')
  })

  it('offers account mutations only for cashier rows', async () => {
    const wrapper = mount(StaffView)
    await flushPromises()

    expect(wrapper.find('[data-test="staff-toggle-1"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="staff-reset-1"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="staff-toggle-2"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="staff-reset-2"]').exists()).toBe(true)
  })

  it('creates a cashier and refreshes the account list', async () => {
    vi.mocked(staffApi.createCashier).mockResolvedValue({
      id: 3,
      username: 'cashier02',
      role: 'CASHIER',
      enabled: true,
      lastLoginAt: null,
      createdAt: '2026-07-28T09:00:00Z',
    })
    const wrapper = mount(StaffView)
    await flushPromises()

    await wrapper.get('[data-test="staff-create"]').trigger('click')
    await wrapper.get('[data-test="staff-username"]').setValue('cashier02')
    await wrapper.get('[data-test="staff-password"]').setValue('TempPass123!')
    await wrapper.get('[data-test="staff-submit"]').trigger('click')
    await flushPromises()

    expect(staffApi.createCashier).toHaveBeenCalledWith({
      username: 'cashier02',
      password: 'TempPass123!',
    })
    expect(staffApi.listStaff).toHaveBeenCalledTimes(2)
  })
})
