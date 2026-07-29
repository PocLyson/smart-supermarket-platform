import {
  authService,
  profileService,
  type CustomerProfile,
} from '../services/auth'
import { NetworkUncertainError } from '../services/http'
import { ordersService } from '../services/orders'
import type { Cart, CartItem } from './cart'
import { cart } from './cart'
import type { CreateOrderRequest, CustomerOrder, OrderPage } from '../types/order'

interface CheckoutAuth {
  ensureSession(): Promise<{ accessToken: string }>
}

interface CheckoutProfile {
  save(profile: CustomerProfile): Promise<unknown>
}

interface CheckoutOrders {
  create(key: string, request: CreateOrderRequest): Promise<CustomerOrder>
  list(query: { page: number; size: number }): Promise<OrderPage>
}

export interface CheckoutDependencies {
  auth: CheckoutAuth
  profile: CheckoutProfile
  orders: CheckoutOrders
  cart: Pick<Cart, 'selectedItems' | 'remove'>
  pendingStorage: PendingCheckoutStorage
  createIdempotencyKey: () => string
}

export interface Checkout {
  updateContact(profile: CustomerProfile): void
  submit(): Promise<CustomerOrder>
  isSubmitting(): boolean
}

interface PendingCheckout {
  idempotencyKey: string
  request: CreateOrderRequest
  purchasedProductIds: number[]
  uncertain: boolean
}

export interface PendingCheckoutStorage {
  read(): unknown
  write(value: PendingCheckout): void
  clear(): void
}

export const PENDING_CHECKOUT_STORAGE_KEY =
  'smart-store-pending-checkout-v1'

const isPendingCheckout = (value: unknown): value is PendingCheckout => {
  if (!value || typeof value !== 'object') return false
  const pending = value as Partial<PendingCheckout>
  return (
    typeof pending.idempotencyKey === 'string' &&
    pending.idempotencyKey.length > 0 &&
    !!pending.request &&
    typeof pending.request.pickupName === 'string' &&
    typeof pending.request.phone === 'string' &&
    Array.isArray(pending.request.items) &&
    pending.request.items.every(
      (item) =>
        Number.isSafeInteger(item.productId) &&
        Number.isSafeInteger(item.quantity) &&
        item.quantity >= 1,
    ) &&
    Array.isArray(pending.purchasedProductIds) &&
    pending.purchasedProductIds.every(Number.isSafeInteger) &&
    typeof pending.uncertain === 'boolean'
  )
}

const validateContact = (profile: CustomerProfile): CustomerProfile => {
  const pickupName = profile.pickupName.trim()
  const phone = profile.phone.trim()
  if (!pickupName) throw new Error('请填写取货人姓名')
  if (pickupName.length > 40) throw new Error('取货人姓名不能超过 40 个字符')
  if (!/^1\d{10}$/.test(phone)) throw new Error('请输入正确的 11 位手机号')
  return { pickupName, phone }
}

const toRequestItems = (
  items: CartItem[],
): CreateOrderRequest['items'] =>
  items.map(({ productId, quantity }) => ({ productId, quantity }))

export const createUuid = (): string => {
  const bytes = Array.from({ length: 16 }, () =>
    Math.floor(Math.random() * 256),
  )
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('')
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-')
}

export const createCheckout = (dependencies: CheckoutDependencies): Checkout => {
  let contact: CustomerProfile = { pickupName: '', phone: '' }
  let submitting = false

  return {
    updateContact: (profile) => {
      contact = { ...profile }
    },
    isSubmitting: () => submitting,
    submit: async () => {
      if (submitting) throw new Error('订单正在提交，请勿重复操作')
      const stored = dependencies.pendingStorage.read()
      if (stored !== undefined && !isPendingCheckout(stored)) {
        dependencies.pendingStorage.clear()
      }
      let pending = isPendingCheckout(stored) ? stored : undefined
      const selected = pending ? [] : dependencies.cart.selectedItems()
      if (!pending && selected.length === 0) {
        throw new Error('请先选择要结算的商品')
      }
      const validContact = pending
        ? {
            pickupName: pending.request.pickupName,
            phone: pending.request.phone,
          }
        : validateContact(contact)
      submitting = true
      try {
        await dependencies.auth.ensureSession()
        await dependencies.profile.save(validContact)
        if (!pending) {
          pending = {
            idempotencyKey: dependencies.createIdempotencyKey(),
            request: {
              ...validContact,
              items: toRequestItems(selected),
            },
            purchasedProductIds: selected.map((item) => item.productId),
            uncertain: false,
          }
          dependencies.pendingStorage.write(pending)
        } else if (pending.uncertain) {
          try {
            await dependencies.orders.list({ page: 1, size: 20 })
          } catch {
            throw new Error('订单结果尚未确认，请稍后重试')
          }
        }
        try {
          const order = await dependencies.orders.create(
            pending.idempotencyKey,
            pending.request,
          )
          dependencies.cart.remove(pending.purchasedProductIds)
          dependencies.pendingStorage.clear()
          return order
        } catch (error) {
          if (error instanceof NetworkUncertainError) {
            pending = { ...pending, uncertain: true }
            dependencies.pendingStorage.write(pending)
            try {
              await dependencies.orders.list({ page: 1, size: 20 })
            } catch {
              // The durable key and original request remain available for retry.
            }
            throw new Error('订单结果尚未确认，请勿修改商品并稍后重试')
          }
          dependencies.pendingStorage.clear()
          throw error
        }
      } finally {
        submitting = false
      }
    },
  }
}

const wxPendingCheckoutStorage: PendingCheckoutStorage = {
  read: () =>
    typeof wx === 'undefined'
      ? undefined
      : (wx.getStorageSync(PENDING_CHECKOUT_STORAGE_KEY) as unknown),
  write: (value) => wx.setStorageSync(PENDING_CHECKOUT_STORAGE_KEY, value),
  clear: () => wx.removeStorageSync(PENDING_CHECKOUT_STORAGE_KEY),
}

export const checkout = createCheckout({
  auth: authService,
  profile: profileService,
  orders: ordersService,
  cart,
  pendingStorage: wxPendingCheckoutStorage,
  createIdempotencyKey: createUuid,
})
