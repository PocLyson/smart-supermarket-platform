export const SESSION_STORAGE_KEY = 'smart-store-session-v1'

export interface CustomerSession {
  accessToken: string
  profileComplete?: boolean
  expiresAt?: number
}

export interface SessionStorage {
  read(): unknown
  write(session: CustomerSession): void
  clear(): void
}

export interface SessionStore {
  current(): CustomerSession | undefined
  save(session: CustomerSession): void
  clear(): void
}

const isSession = (value: unknown): value is CustomerSession => {
  if (!value || typeof value !== 'object') return false
  const session = value as Partial<CustomerSession>
  return (
    typeof session.accessToken === 'string' &&
    session.accessToken.length > 0 &&
    (session.expiresAt === undefined ||
      (typeof session.expiresAt === 'number' && session.expiresAt > Date.now()))
  )
}

export const createSessionStore = (storage: SessionStorage): SessionStore => ({
  current: () => {
    const value = storage.read()
    return isSession(value) ? { ...value } : undefined
  },
  save: (session) => storage.write({ ...session }),
  clear: () => storage.clear(),
})

const wxSessionStorage: SessionStorage = {
  read: () =>
    typeof wx === 'undefined'
      ? undefined
      : (wx.getStorageSync(SESSION_STORAGE_KEY) as unknown),
  write: (session) => wx.setStorageSync(SESSION_STORAGE_KEY, session),
  clear: () => wx.removeStorageSync(SESSION_STORAGE_KEY),
}

export const sessionStore = createSessionStore(wxSessionStorage)
