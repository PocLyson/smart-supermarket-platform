import type { MerchantDashboardSummary } from '../types/dashboard'
import { merchantHttp, type MerchantHttp } from './http'

export const createDashboardService = (
  client: Pick<MerchantHttp, 'get'>,
) => ({
  summary: (): Promise<MerchantDashboardSummary> =>
    client.get<MerchantDashboardSummary>('/api/merchant-mini/dashboard'),
})

export const merchantDashboardService = createDashboardService(merchantHttp)
