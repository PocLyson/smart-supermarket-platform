import { jsonBody, request } from './http'
import type { PageResult } from '@/types/common'

export interface InventoryItem {
  productId: number
  productName: string
  categoryId: number
  categoryName: string
  availableQuantity: number
  unit: string
  updatedAt: string
}

export type InventoryStockStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK'

export interface InventoryQuery {
  categoryId?: number
  stockStatus?: InventoryStockStatus
}

export interface InventoryAdjustmentRequest {
  delta: number
  reason: string
}

export const listInventory = (query: InventoryQuery = {}): Promise<PageResult<InventoryItem>> => {
  const params = new URLSearchParams()
  if (query.categoryId !== undefined) params.set('categoryId', String(query.categoryId))
  if (query.stockStatus) params.set('stockStatus', query.stockStatus)
  const queryString = params.toString()
  return request(`/api/admin/inventory${queryString ? `?${queryString}` : ''}`)
}

export const adjustInventory = (
  productId: number,
  payload: InventoryAdjustmentRequest,
): Promise<InventoryItem> =>
  request(`/api/admin/inventory/${productId}/adjustments`, {
    method: 'POST',
    ...jsonBody(payload),
  })
