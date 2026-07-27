import { jsonBody, request } from './http'
import type { PageResult } from '@/types/common'

export interface InventoryItem {
  productId: number
  productName: string
  availableQuantity: number
  unit: string
  updatedAt: string
}

export interface InventoryAdjustmentRequest {
  delta: number
  reason: string
}

export const listInventory = (): Promise<PageResult<InventoryItem>> =>
  request('/api/admin/inventory')

export const adjustInventory = (
  productId: number,
  payload: InventoryAdjustmentRequest,
): Promise<InventoryItem> =>
  request(`/api/admin/inventory/${productId}/adjustments`, {
    method: 'POST',
    ...jsonBody(payload),
  })
