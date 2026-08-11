import { merchantOrdersService } from '../../services/orders'
import { merchantSessionStore } from '../../store/session'
import { buildOrderDetailUrl, type MerchantOrder, type PaymentMethod } from '../../types/order'
import {
  parsePickupScan,
  paymentOptionsFor,
  presentPickupPreview,
  readablePickupError,
  resolvePayAtStoreMethod,
  type PickupPreview,
} from './verification'

export { parsePickupScan } from './verification'

type VerificationStage = 'INPUT' | 'CONFIRM' | 'SUCCESS'

let pickupRequestSequence = 0

const createPickupRequestId = (): string => {
  pickupRequestSequence += 1
  return `pickup-${Date.now().toString(36)}-${pickupRequestSequence.toString(36)}`
}

const pickupIntentKey = (
  orderNo: string,
  pickupCode: string,
  method: PaymentMethod,
): string => `${orderNo}\u0000${pickupCode}\u0000${method}`

const askForConfirmation = (): Promise<boolean> => new Promise((resolve) => {
  wx.showModal({
    title: '确认核销取货',
    content: '请再次核对订单、取货人和付款状态。核销后订单将完成。',
    confirmText: '确认核销',
    cancelText: '再检查一下',
    success: ({ confirm }) => resolve(confirm),
    fail: () => resolve(false),
  })
})

Page({
  data: {
    stage: 'INPUT' as VerificationStage,
    orderNo: '',
    pickupCode: '',
    preview: null as PickupPreview | null,
    completedOrder: null as MerchantOrder | null,
    paymentOptions: [] as PaymentMethod[],
    selectedPaymentMethod: '' as PaymentMethod | '',
    openedFromDetail: false,
    isPreviewLoading: false,
    isSubmitting: false,
    verificationRequestId: '',
    verificationIntentKey: '',
    errorMessage: '',
  },

  onLoad(options: Record<string, string | undefined>) {
    const candidateCode = options.pickupCode ? decodeURIComponent(options.pickupCode) : ''
    let pickupCode = ''
    let errorMessage = ''
    if (candidateCode) {
      try {
        pickupCode = parsePickupScan(candidateCode).pickupCode
      } catch (error) {
        errorMessage = readablePickupError(error)
      }
    }
    this.setData({
      pickupCode,
      errorMessage,
      openedFromDetail: options.from === 'detail',
    })
  },

  onShow() {
    if (!merchantSessionStore.current()) {
      wx.reLaunch({ url: '/pages/login/index' })
    }
  },

  onPickupCodeInput(event: WechatMiniprogram.Input) {
    if (this.data.isSubmitting) return
    this.setData({
      orderNo: '',
      pickupCode: event.detail.value,
      stage: 'INPUT',
      preview: null,
      completedOrder: null,
      verificationRequestId: '',
      verificationIntentKey: '',
      errorMessage: '',
    })
  },

  onPaymentMethodChange(event: WechatMiniprogram.RadioGroupChange) {
    if (this.data.isSubmitting) return
    this.setData({
      selectedPaymentMethod: event.detail.value as PaymentMethod,
      verificationRequestId: '',
      verificationIntentKey: '',
      errorMessage: '',
    })
  },

  async scanPickup() {
    if (this.data.isPreviewLoading || this.data.isSubmitting) return
    await new Promise<void>((resolve) => {
      wx.scanCode({
        scanType: ['qrCode'],
        success: async ({ result }) => {
          try {
            const { pickupCode } = parsePickupScan(result)
            this.setData({
              orderNo: '',
              pickupCode,
              stage: 'INPUT',
              preview: null,
              completedOrder: null,
              verificationRequestId: '',
              verificationIntentKey: '',
              errorMessage: '',
            })
            await this.loadPreview()
          } catch (error) {
            this.setData({
              stage: 'INPUT',
              preview: null,
              completedOrder: null,
              verificationRequestId: '',
              verificationIntentKey: '',
              errorMessage: readablePickupError(error),
            })
          } finally {
            resolve()
          }
        },
        fail: ({ errMsg }) => {
          if (!errMsg.includes('cancel')) {
            this.setData({ errorMessage: '扫码失败，请重试或手动输入取件码' })
          }
          resolve()
        },
      })
    })
  },

  async loadPreview() {
    if (this.data.isPreviewLoading || this.data.isSubmitting) return
    let pickupCode = ''
    try {
      pickupCode = parsePickupScan(this.data.pickupCode).pickupCode
    } catch (error) {
      this.setData({ errorMessage: readablePickupError(error) })
      return
    }
    this.setData({ isPreviewLoading: true, errorMessage: '' })
    try {
      const order = await merchantOrdersService.pickupPreview(pickupCode)
      if (order.status === 'COMPLETED') {
        throw Object.assign(new Error('订单已完成，无需重复核销'), {
          code: 'ORDER_ALREADY_COMPLETED',
        })
      }
      if (order.status !== 'READY_FOR_PICKUP') {
        throw Object.assign(new Error('订单当前状态不允许核销，请重新加载后重试'), {
          code: 'INVALID_ORDER_STATUS',
        })
      }
      this.setData({
        orderNo: order.orderNo,
        pickupCode,
        preview: presentPickupPreview(order),
        paymentOptions: paymentOptionsFor(order.paymentStatus),
        selectedPaymentMethod: '',
        stage: 'CONFIRM',
        completedOrder: null,
        verificationRequestId: '',
        verificationIntentKey: '',
      })
    } catch (error) {
      this.setData({
        preview: null,
        completedOrder: null,
        stage: 'INPUT',
        verificationRequestId: '',
        verificationIntentKey: '',
        errorMessage: readablePickupError(error),
      })
    } finally {
      this.setData({ isPreviewLoading: false })
    }
  },

  async confirmPickup() {
    if (
      this.data.stage !== 'CONFIRM'
      || !this.data.preview
      || this.data.isSubmitting
    ) return
    let method: PaymentMethod
    try {
      method = resolvePayAtStoreMethod(
        this.data.preview,
        this.data.selectedPaymentMethod,
      )
    } catch (error) {
      this.setData({ errorMessage: readablePickupError(error) })
      return
    }
    const previewSnapshot = this.data.preview
    const pickupCodeSnapshot = this.data.pickupCode
    const intentKey = pickupIntentKey(
      previewSnapshot.orderNo,
      pickupCodeSnapshot,
      method,
    )
    this.setData({ isSubmitting: true, errorMessage: '' })
    const confirmed = await askForConfirmation()
    let currentMethod: PaymentMethod | undefined
    try {
      if (this.data.preview) {
        currentMethod = resolvePayAtStoreMethod(
          this.data.preview,
          this.data.selectedPaymentMethod,
        )
      }
    } catch {
      currentMethod = undefined
    }
    const stillOwnsConfirmation = Boolean(
      this.data.isSubmitting
      && this.data.stage === 'CONFIRM'
      && this.data.preview
      && this.data.preview.orderNo === previewSnapshot.orderNo
      && this.data.pickupCode === pickupCodeSnapshot
      && currentMethod === method,
    )
    if (!stillOwnsConfirmation) return
    if (!confirmed) {
      this.setData({ isSubmitting: false })
      return
    }
    const requestId = this.data.verificationIntentKey === intentKey
      && this.data.verificationRequestId
      ? this.data.verificationRequestId
      : createPickupRequestId()
    this.setData({
      verificationRequestId: requestId,
      verificationIntentKey: intentKey,
    })
    try {
      const completedOrder = await merchantOrdersService.verifyPickup(
        previewSnapshot.orderNo,
        pickupCodeSnapshot,
        method,
        requestId,
      )
      if (
        !this.data.isSubmitting
        || this.data.stage !== 'CONFIRM'
        || this.data.verificationRequestId !== requestId
        || this.data.verificationIntentKey !== intentKey
      ) return
      this.setData({
        stage: 'SUCCESS',
        preview: presentPickupPreview(completedOrder),
        completedOrder,
        verificationRequestId: '',
        verificationIntentKey: '',
      })
      this.getOpenerEventChannel().emit('pickupVerified', completedOrder)
      wx.showToast({ title: '核销成功', icon: 'success' })
    } catch (error) {
      if (
        this.data.stage === 'CONFIRM'
        && this.data.verificationRequestId === requestId
        && this.data.verificationIntentKey === intentKey
      ) {
        this.setData({
          completedOrder: null,
          errorMessage: readablePickupError(error),
        })
      }
    } finally {
      if (
        (this.data.stage as VerificationStage) === 'SUCCESS'
        || (
          this.data.verificationRequestId === requestId
          && this.data.verificationIntentKey === intentKey
        )
      ) {
        this.setData({ isSubmitting: false })
      }
    }
  },

  editInformation() {
    if (this.data.isSubmitting) return
    this.setData({
      stage: 'INPUT',
      orderNo: '',
      preview: null,
      verificationRequestId: '',
      verificationIntentKey: '',
      errorMessage: '',
    })
  },

  continueVerification() {
    if (this.data.isSubmitting) return
    if (this.data.openedFromDetail) {
      wx.reLaunch({ url: '/pages/verify-pickup/index' })
      return
    }
    this.setData({
      stage: 'INPUT',
      orderNo: '',
      pickupCode: '',
      preview: null,
      completedOrder: null,
      paymentOptions: [],
      selectedPaymentMethod: '',
      openedFromDetail: false,
      verificationRequestId: '',
      verificationIntentKey: '',
      errorMessage: '',
    })
  },

  viewOrder() {
    const orderNo = this.data.completedOrder?.orderNo
    if (!orderNo) return
    if (this.data.openedFromDetail) {
      wx.navigateBack()
      return
    }
    wx.redirectTo({
      url: buildOrderDetailUrl(orderNo, {
        status: '',
        paymentStatus: '',
        keyword: '',
        page: 0,
        scrollTop: 0,
      }),
    })
  },
})
