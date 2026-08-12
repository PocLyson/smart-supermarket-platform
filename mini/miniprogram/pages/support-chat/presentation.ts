import type { SupportMessage } from '../../types/support'

export type PresentedCustomerSupportMessage = SupportMessage & {
  isMine: boolean
  orderNo?: string | null
  displayTime: string
}

export const presentCustomerSupportMessage = (
  message: SupportMessage,
): PresentedCustomerSupportMessage => ({
  ...message,
  orderNo: message.relatedOrderNo,
  isMine: message.senderSide === 'CUSTOMER',
  displayTime: message.createdAt
    ? message.createdAt.replace('T', ' ').slice(5, 16)
    : '',
})
