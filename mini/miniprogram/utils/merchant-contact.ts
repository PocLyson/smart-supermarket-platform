import { storeService } from '../services/store'
import type { StoreContact } from '../types/store'

export const EMERGENCY_STORE_PHONE = '18653045492'

type StoreContactService = Pick<typeof storeService, 'contact'>

export interface MerchantPhoneApi {
  makePhoneCall(options: {
    phoneNumber: string
    success?: () => void
    fail?: () => void
  }): void
  showModal(options: {
    title: string
    content: string
    showCancel: boolean
  }): void
}

const emergencyStoreContact = (): StoreContact => ({
  phone: EMERGENCY_STORE_PHONE,
  customerServiceEnabled: false,
})

const isValidStorePhone = (phone: unknown): phone is string =>
  typeof phone === 'string' && /^1[3-9]\d{9}$/.test(phone)

export const loadStoreContact = async (
  service: StoreContactService = storeService,
): Promise<StoreContact> => {
  try {
    const contact = await service.contact()
    return isValidStorePhone(contact.phone) ? contact : emergencyStoreContact()
  } catch {
    return emergencyStoreContact()
  }
}

export const callStorePhone = (
  phone: string,
  wxApi: MerchantPhoneApi = wx as unknown as MerchantPhoneApi,
): Promise<void> =>
  new Promise((resolve) => {
    const showFailure = () => {
      wxApi.showModal({
        title: '联系门店',
        content: `拨打失败，请联系门店：${phone}`,
        showCancel: false,
      })
      resolve()
    }

    try {
      wxApi.makePhoneCall({
        phoneNumber: phone,
        success: resolve,
        fail: showFailure,
      })
    } catch {
      showFailure()
    }
  })
