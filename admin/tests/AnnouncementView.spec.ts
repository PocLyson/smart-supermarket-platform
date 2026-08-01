import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { ElMessageBox, ElPagination } from 'element-plus'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import AnnouncementView from '@/views/announcements/AnnouncementView.vue'
import AdminLayout from '@/layouts/AdminLayout.vue'
import { createAdminRouter } from '@/router'
import { useAuthStore } from '@/stores/auth'
import * as announcementApi from '@/api/announcements'

vi.mock('@/api/announcements', () => ({
  listAnnouncements: vi.fn(),
  createAnnouncement: vi.fn(),
  updateAnnouncement: vi.fn(),
  publishAnnouncement: vi.fn(),
  offlineAnnouncement: vi.fn(),
  deleteAnnouncement: vi.fn(),
}))

const announcements = [
  {
    id: 1,
    title: '营业调整',
    content: '周日20点闭店',
    status: 'DRAFT' as const,
    publishedAt: null,
    createdBy: 1,
    updatedBy: 1,
    createdAt: '2026-08-01T08:00:00Z',
    updatedAt: '2026-08-01T08:00:00Z',
  },
  {
    id: 2,
    title: '已发布公告',
    content: '正在展示',
    status: 'PUBLISHED' as const,
    publishedAt: '2026-08-01T09:00:00Z',
    createdBy: 1,
    updatedBy: 1,
    createdAt: '2026-08-01T08:00:00Z',
    updatedAt: '2026-08-01T09:00:00Z',
  },
  {
    id: 3,
    title: '已下线公告',
    content: '可以再次发布',
    status: 'OFFLINE' as const,
    publishedAt: '2026-08-01T07:00:00Z',
    createdBy: 1,
    updatedBy: 1,
    createdAt: '2026-08-01T06:00:00Z',
    updatedAt: '2026-08-01T10:00:00Z',
  },
]

describe('AnnouncementView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(announcementApi.listAnnouncements).mockResolvedValue({
      items: announcements,
      page: 0,
      size: 20,
      total: announcements.length,
    })
  })

  it('loads the selected status and keeps the editor within title and content limits', async () => {
    const wrapper = mount(AnnouncementView)
    await flushPromises()

    expect(announcementApi.listAnnouncements).toHaveBeenCalledWith({ page: 0, size: 20 })
    await wrapper.get('[data-test="announcement-status"]').setValue('DRAFT')
    await flushPromises()
    expect(announcementApi.listAnnouncements).toHaveBeenLastCalledWith({
      status: 'DRAFT',
      page: 0,
      size: 20,
    })

    await wrapper.get('[data-test="announcement-create"]').trigger('click')
    await wrapper.get('[data-test="announcement-title"]').setValue('x'.repeat(61))
    await wrapper.get('[data-test="announcement-content"]').setValue('y'.repeat(2001))
    expect(wrapper.get('[data-test="announcement-title-count"]').text()).toBe('61/60')
    expect(wrapper.get('[data-test="announcement-content-count"]').text()).toBe('2001/2000')
    expect(
      (wrapper.get('[data-test="announcement-submit"]').element as HTMLButtonElement).disabled,
    ).toBe(true)
  })

  it('paginates announcement results and resets to the first page when status changes', async () => {
    vi.mocked(announcementApi.listAnnouncements).mockResolvedValue({
      items: announcements,
      page: 0,
      size: 20,
      total: 41,
    })
    const wrapper = mount(AnnouncementView)
    await flushPromises()

    const pagination = wrapper.getComponent(ElPagination)
    expect(pagination.props('currentPage')).toBe(1)

    pagination.vm.$emit('current-change', 2)
    await flushPromises()
    expect(announcementApi.listAnnouncements).toHaveBeenLastCalledWith({ page: 1, size: 20 })

    await wrapper.get('[data-test="announcement-status"]').setValue('DRAFT')
    await flushPromises()
    expect(announcementApi.listAnnouncements).toHaveBeenLastCalledWith({
      status: 'DRAFT',
      page: 0,
      size: 20,
    })
    expect(pagination.props('currentPage')).toBe(1)
  })

  it('creates an announcement from the editor', async () => {
    vi.mocked(announcementApi.createAnnouncement).mockResolvedValue(announcements[0])
    const wrapper = mount(AnnouncementView)
    await flushPromises()

    await wrapper.get('[data-test="announcement-create"]').trigger('click')
    await wrapper.get('[data-test="announcement-title"]').setValue('营业调整')
    await wrapper.get('[data-test="announcement-content"]').setValue('周日20点闭店')
    await wrapper.get('[data-test="announcement-submit"]').trigger('click')
    await flushPromises()

    expect(announcementApi.createAnnouncement).toHaveBeenCalledWith({
      title: '营业调整',
      content: '周日20点闭店',
    })
  })

  it('only offers published announcements offline, while offline announcements can be edited, deleted and republished', async () => {
    const wrapper = mount(AnnouncementView)
    await flushPromises()

    expect(wrapper.find('[data-test="announcement-edit-2"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="announcement-delete-2"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="announcement-offline-2"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="announcement-edit-3"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="announcement-delete-3"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="announcement-publish-3"]').exists()).toBe(true)
  })

  it('confirms publishing and offlining before calling the API', async () => {
    vi.spyOn(ElMessageBox, 'confirm').mockResolvedValue('confirm' as never)
    vi.mocked(announcementApi.publishAnnouncement).mockResolvedValue(announcements[1])
    vi.mocked(announcementApi.offlineAnnouncement).mockResolvedValue(announcements[2])
    const wrapper = mount(AnnouncementView)
    await flushPromises()

    await wrapper.get('[data-test="announcement-publish-1"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-test="announcement-offline-2"]').trigger('click')
    await flushPromises()

    expect(announcementApi.publishAnnouncement).toHaveBeenCalledWith(1)
    expect(announcementApi.offlineAnnouncement).toHaveBeenCalledWith(2)
  })

  it('does not delete until confirmation and then refreshes the list', async () => {
    vi.spyOn(ElMessageBox, 'confirm').mockRejectedValueOnce('cancel')
    const wrapper = mount(AnnouncementView)
    await flushPromises()

    await wrapper.get('[data-test="announcement-delete-3"]').trigger('click')
    await flushPromises()
    expect(announcementApi.deleteAnnouncement).not.toHaveBeenCalled()

    vi.spyOn(ElMessageBox, 'confirm').mockResolvedValueOnce('confirm' as never)
    vi.mocked(announcementApi.deleteAnnouncement).mockResolvedValue({ deleted: true })
    await wrapper.get('[data-test="announcement-delete-3"]').trigger('click')
    await flushPromises()
    expect(announcementApi.deleteAnnouncement).toHaveBeenCalledWith(3)
    expect(announcementApi.listAnnouncements).toHaveBeenCalledTimes(2)
  })
})

describe('announcement route and navigation', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('rejects cashier navigation to the owner-only announcement page', async () => {
    const auth = useAuthStore()
    auth.setSession({
      accessToken: 'cashier-token',
      role: 'CASHIER',
      staffId: 2,
      username: 'cashier',
    })
    const router = createAdminRouter()
    await router.push('/announcements')
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/forbidden')
  })

  it('shows the announcements navigation item to an owner only', () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/orders', component: { template: '<div />' } }],
    })
    const auth = useAuthStore()
    auth.setSession({
      accessToken: 'owner-token',
      role: 'OWNER',
      staffId: 1,
      username: 'owner',
    })
    const owner = mount(AdminLayout, {
      global: { plugins: [router], stubs: { RouterView: true } },
    })
    expect(owner.find('nav').text()).toContain('公告管理')

    auth.setSession({
      accessToken: 'cashier-token',
      role: 'CASHIER',
      staffId: 2,
      username: 'cashier',
    })
    const cashier = mount(AdminLayout, {
      global: { plugins: [router], stubs: { RouterView: true } },
    })
    expect(cashier.find('nav').text()).not.toContain('公告管理')
  })
})
