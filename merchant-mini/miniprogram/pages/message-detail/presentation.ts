import type { MerchantSupportMessage } from '../../types/support'

export type PresentedMerchantSupportMessage = MerchantSupportMessage & {
  isMine: boolean
  orderNo?: string | null
  displayTime: string
}

export const presentMerchantSupportMessage = (
  item: MerchantSupportMessage,
): PresentedMerchantSupportMessage => ({
  ...item,
  orderNo: item.relatedOrderNo,
  isMine: item.senderSide === 'MERCHANT',
  displayTime: item.createdAt ? item.createdAt.replace('T', ' ').slice(5, 16) : '',
})
