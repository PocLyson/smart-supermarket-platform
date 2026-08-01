import { jsonBody, request } from './http'
import type { PageResult } from '@/types/common'

export interface Category {
  id: number
  name: string
  sortOrder: number
  enabled: boolean
  updatedAt?: string
}

export interface CategoryWriteRequest {
  name: string
  sortOrder: number
  enabled: boolean
}

export interface Product {
  id: number
  name: string
  categoryId: number
  categoryName: string
  priceCent: number
  unit: string
  coverImageUrl: string
  description: string
  onShelf: boolean
  archived: boolean
  archivedAt: string | null
  archivedBy: number | null
  updatedAt?: string
}

export type ProductArchiveStatus = 'ACTIVE' | 'ARCHIVED' | 'ALL'

export interface ProductWriteRequest {
  name: string
  categoryId: number
  priceCent: number
  unit: string
  coverImageUrl: string
  description: string
  onShelf: boolean
  initialStock?: number
}

export interface ProductQuery {
  categoryId?: number
  keyword?: string
  archiveStatus?: ProductArchiveStatus
  page?: number
  size?: number
}

const queryString = (query: Record<string, string | number | undefined>): string => {
  const params = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value))
  })
  const value = params.toString()
  return value ? `?${value}` : ''
}

export const listCategories = (): Promise<Category[]> => request('/api/admin/categories')

export const createCategory = (payload: CategoryWriteRequest): Promise<Category> =>
  request('/api/admin/categories', { method: 'POST', ...jsonBody(payload) })

export const updateCategory = (id: number, payload: CategoryWriteRequest): Promise<Category> =>
  request(`/api/admin/categories/${id}`, { method: 'PUT', ...jsonBody(payload) })

export const listProducts = (query: ProductQuery = {}): Promise<PageResult<Product>> =>
  request(
    `/api/admin/products${queryString({
      categoryId: query.categoryId,
      keyword: query.keyword,
      archiveStatus: query.archiveStatus,
      page: query.page,
      size: query.size,
    })}`,
  )

export const createProduct = (payload: ProductWriteRequest): Promise<Product> =>
  request('/api/admin/products', { method: 'POST', ...jsonBody(payload) })

export const updateProduct = (id: number, payload: ProductWriteRequest): Promise<Product> =>
  request(`/api/admin/products/${id}`, { method: 'PUT', ...jsonBody(payload) })

export const setProductShelf = (id: number, onShelf: boolean): Promise<Product> =>
  request(`/api/admin/products/${id}/shelf`, {
    method: 'PATCH',
    ...jsonBody({ onShelf }),
  })

export const archiveProduct = (id: number): Promise<Product> =>
  request(`/api/admin/products/${id}`, { method: 'DELETE' })

export const restoreProduct = (id: number): Promise<Product> =>
  request(`/api/admin/products/${id}/restore`, { method: 'POST' })
