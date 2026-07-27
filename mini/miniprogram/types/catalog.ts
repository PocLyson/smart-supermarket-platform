export interface Category {
  id: number
  name: string
  enabled: boolean
  sortOrder?: number
}

export interface ProductSummary {
  id: number
  name: string
  categoryId: number
  priceCent: number
  unit: string
  coverImageUrl: string
  onShelf: boolean
}

export interface ProductDetail extends ProductSummary {
  description: string
  availableStock?: number
}

export interface PageResult<T> {
  items: T[]
  page: number
  size: number
  total: number
}

export interface ProductQuery {
  categoryId?: number
  keyword?: string
  page: number
  size: number
}
