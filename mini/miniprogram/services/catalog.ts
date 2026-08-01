import type {
  Category,
  PageResult,
  ProductDetail,
  ProductQuery,
  ProductSummary,
} from '../types/catalog'
import { resolveApiAssetUrl } from '../config/env'
import { http, type HttpClient } from './http'

type CatalogHttp = Pick<HttpClient, 'get'>

const withResolvedImage = <T extends { coverImageUrl: string }>(product: T): T => ({
  ...product,
  coverImageUrl: resolveApiAssetUrl(product.coverImageUrl),
})

export const createCatalogService = (client: CatalogHttp) => ({
  listCategories: (): Promise<Category[]> =>
    client.get<Category[]>('/api/mini/categories'),
  listProducts: async (
    query: ProductQuery,
  ): Promise<PageResult<ProductSummary>> => {
    const result = await client.get<PageResult<ProductSummary>>(
      '/api/mini/products',
      { ...query },
    )
    return {
      ...result,
      items: result.items.map(withResolvedImage),
    }
  },
  getProduct: async (id: number): Promise<ProductDetail> =>
    withResolvedImage(
      await client.get<ProductDetail>(`/api/mini/products/${id}`),
    ),
})

export const catalogService = createCatalogService(http)
