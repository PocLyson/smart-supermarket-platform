import type { StoreContact } from '../types/store'
import { http, type HttpClient } from './http'

type StoreHttp = Pick<HttpClient, 'get'>

export const createStoreService = (client: StoreHttp) => ({
  contact: (): Promise<StoreContact> =>
    client.get<StoreContact>('/api/mini/store/contact'),
})

export const storeService = createStoreService(http)
