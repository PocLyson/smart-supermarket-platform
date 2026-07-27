import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { StaffSession } from '@/types/common'

export const SESSION_STORAGE_KEY = 'smart-store-admin-session'

const restoreSession = (): StaffSession | null => {
  const raw = localStorage.getItem(SESSION_STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as StaffSession
  } catch {
    localStorage.removeItem(SESSION_STORAGE_KEY)
    return null
  }
}

export const useAuthStore = defineStore('auth', () => {
  const session = ref<StaffSession | null>(restoreSession())
  const isAuthenticated = computed(() => Boolean(session.value?.accessToken))
  const isOwner = computed(() => session.value?.role === 'OWNER')

  const setSession = (next: StaffSession): void => {
    session.value = next
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(next))
  }

  const clearSession = (): void => {
    session.value = null
    localStorage.removeItem(SESSION_STORAGE_KEY)
  }

  return { session, isAuthenticated, isOwner, setSession, clearSession }
})
