import type { StoreContact } from '../types/store'
import { http, type HttpClient } from './http'

type StoreHttp = Pick<HttpClient, 'get'>

export const createStoreService = (client: StoreHttp) => ({
  contact: (): Promise<StoreContact> =>
    client.get<StoreContact>(
      '/api/mini/store/contact',
      undefined,
      undefined,
      { silentError: true },
    ),
})

export const storeService = createStoreService(http)
