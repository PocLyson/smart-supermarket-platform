export const MERCHANT_SESSION_STORAGE_KEY = 'smart-store-merchant-session-v1'

export type MerchantRole = 'OWNER' | 'CASHIER'

export interface MerchantSession {
  accessToken: string
  role: MerchantRole
  staffId: number
  username: string
  expiresAt: number
}

export interface MerchantSessionStorage {
  read(): unknown
  write(session: MerchantSession): void
  clear(): void
}

export interface MerchantSessionStore {
  current(): MerchantSession | undefined
  save(session: MerchantSession): void
  clear(): void
  revision(): number
}

const isMerchantSession = (value: unknown): value is MerchantSession => {
  if (!value || typeof value !== 'object') return false
  const session = value as Partial<MerchantSession>
  return (
    typeof session.accessToken === 'string' &&
    session.accessToken.length > 0 &&
    (session.role === 'OWNER' || session.role === 'CASHIER') &&
    typeof session.staffId === 'number' &&
    Number.isFinite(session.staffId) &&
    typeof session.username === 'string' &&
    session.username.length > 0 &&
    typeof session.expiresAt === 'number' &&
    session.expiresAt > Date.now()
  )
}

export const createMerchantSessionStore = (
  storage: MerchantSessionStorage,
): MerchantSessionStore => {
  let revision = 0

  const clear = (): void => {
    storage.clear()
    revision += 1
  }

  return {
    current: () => {
      const value = storage.read()
      if (!isMerchantSession(value)) {
        if (value !== undefined && value !== null) clear()
        return undefined
      }
      return { ...value }
    },
    save: (session) => {
      storage.write({ ...session })
      revision += 1
    },
    clear,
    revision: () => revision,
  }
}

const wxMerchantStorage: MerchantSessionStorage = {
  read: () =>
    typeof wx === 'undefined'
      ? undefined
      : (wx.getStorageSync(MERCHANT_SESSION_STORAGE_KEY) as unknown),
  write: (session) => wx.setStorageSync(MERCHANT_SESSION_STORAGE_KEY, session),
  clear: () => wx.removeStorageSync(MERCHANT_SESSION_STORAGE_KEY),
}

export const merchantSessionStore = createMerchantSessionStore(wxMerchantStorage)
