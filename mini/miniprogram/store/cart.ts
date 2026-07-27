export const CART_STORAGE_KEY = 'smart-store-cart-v1'

export interface CartProduct {
  productId: number
  name: string
  coverImageUrl: string
  unitPriceCent: number
}

export interface CartItem extends CartProduct {
  quantity: number
  selected: boolean
}

export interface CartStorage {
  read(): unknown
  write(items: CartItem[]): void
}

export interface Cart {
  items(): CartItem[]
  add(product: CartProduct): void
  setQuantity(productId: number, quantity: number): void
  setSelected(productId: number, selected: boolean): void
  remove(productIds: number[]): void
  selectedItems(): CartItem[]
  selectedTotalCent(): number
}

const isStoredItem = (value: unknown): value is CartItem => {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<CartItem>
  return (
    Number.isSafeInteger(item.productId) &&
    typeof item.name === 'string' &&
    typeof item.coverImageUrl === 'string' &&
    Number.isSafeInteger(item.unitPriceCent) &&
    Number.isSafeInteger(item.quantity) &&
    Number(item.quantity) >= 1 &&
    typeof item.selected === 'boolean'
  )
}

export const createCart = (storage: CartStorage): Cart => {
  const stored = storage.read()
  let current: CartItem[] = Array.isArray(stored)
    ? stored.filter(isStoredItem).map((item) => ({ ...item }))
    : []

  const persist = (): void => storage.write(current.map((item) => ({ ...item })))
  const find = (productId: number): CartItem | undefined =>
    current.find((item) => item.productId === productId)

  return {
    items: () => current.map((item) => ({ ...item })),
    add: (product) => {
      const existing = find(product.productId)
      if (existing) {
        existing.quantity += 1
      } else {
        current.push({ ...product, quantity: 1, selected: true })
      }
      persist()
    },
    setQuantity: (productId, quantity) => {
      if (!Number.isInteger(quantity) || quantity < 1) {
        throw new Error('商品数量至少为 1')
      }
      const item = find(productId)
      if (!item) throw new Error('购物车中没有该商品')
      item.quantity = quantity
      persist()
    },
    setSelected: (productId, selected) => {
      const item = find(productId)
      if (!item) throw new Error('购物车中没有该商品')
      item.selected = selected
      persist()
    },
    remove: (productIds) => {
      const removed = new Set(productIds)
      current = current.filter((item) => !removed.has(item.productId))
      persist()
    },
    selectedItems: () =>
      current.filter((item) => item.selected).map((item) => ({ ...item })),
    selectedTotalCent: () =>
      current
        .filter((item) => item.selected)
        .reduce(
          (total, item) => total + item.unitPriceCent * item.quantity,
          0,
        ),
  }
}

export const wxCartStorage: CartStorage = {
  read: () =>
    typeof wx === 'undefined'
      ? []
      : (wx.getStorageSync(CART_STORAGE_KEY) as unknown),
  write: (items) => wx.setStorageSync(CART_STORAGE_KEY, items),
}

export const cart = createCart(wxCartStorage)
