import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { createAdminRouter } from '@/router'
import { useAuthStore } from '@/stores/auth'

describe('admin route permissions', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it.each(['/products', '/categories', '/inventory', '/staff', '/audit'])(
    'rejects cashier direct navigation to %s',
    async (path) => {
      const auth = useAuthStore()
      auth.setSession({
        accessToken: 'cashier-token',
        role: 'CASHIER',
        staffId: 2,
        username: 'cashier',
      })
      const router = createAdminRouter()

      await router.push(path)
      await router.isReady()

      expect(router.currentRoute.value.path).toBe('/forbidden')
    },
  )
})
