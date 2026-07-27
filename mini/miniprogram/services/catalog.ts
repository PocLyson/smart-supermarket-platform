import type {
  Category,
  PageResult,
  ProductDetail,
  ProductQuery,
  ProductSummary,
} from '../types/catalog'
import { http, type HttpClient } from './http'

type CatalogHttp = Pick<HttpClient, 'get'>

export const createCatalogService = (client: CatalogHttp) => ({
  listCategories: (): Promise<Category[]> =>
    client.get<Category[]>('/api/mini/categories'),
  listProducts: (query: ProductQuery): Promise<PageResult<ProductSummary>> =>
    client.get<PageResult<ProductSummary>>('/api/mini/products', { ...query }),
  getProduct: (id: number): Promise<ProductDetail> =>
    client.get<ProductDetail>(`/api/mini/products/${id}`),
})

export const catalogService = createCatalogService(http)
