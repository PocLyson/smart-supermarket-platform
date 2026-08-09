import { merchantOrdersService } from '../../services/orders'
import { merchantSessionStore, type MerchantRole } from '../../store/session'
import {
  availableOrderAction,
  canOwnerCancel,
  formatMoney,
  formatOrderTime,
  maskPhone,
  orderStatusLabel,
  paymentMethodLabel,
  paymentStatusLabel,
  readableOrderError,
  type MerchantOrder,
  type OrderPrimaryAction,
  type PaymentMethod,
} from '../../types/order'

interface PresentedOrder extends MerchantOrder {
  amountText: string
  createdAtText: string
  maskedPhone: string
  statusLabel: string
  paymentLabel: string
  paymentMethodText: string
  items: Array<MerchantOrder['items'][number] & {
    unitPriceText: string
    subtotalText: string
  }>
  history: Array<MerchantOrder['history'][number] & {
    statusLabel: string
    createdAtText: string
  }>
}

const presentOrder = (order: MerchantOrder): PresentedOrder => ({
  ...order,
  amountText: formatMoney(order.totalCent),
  createdAtText: formatOrderTime(order.createdAt),
  maskedPhone: maskPhone(order.phone),
  statusLabel: orderStatusLabel[order.status],
  paymentLabel: paymentStatusLabel[order.paymentStatus],
  paymentMethodText: order.paymentMethod
    ? paymentMethodLabel[order.paymentMethod]
    : '未选择',
  items: order.items.map((item) => ({
    ...item,
    unitPriceText: formatMoney(item.unitPriceCent),
    subtotalText: formatMoney(item.subtotalCent),
  })),
  history: order.history.map((item) => ({
    ...item,
    statusLabel: orderStatusLabel[item.toStatus],
    createdAtText: formatOrderTime(item.createdAt),
  })),
})

const primaryActionLabel: Record<OrderPrimaryAction, string> = {
  ACCEPT: '接单',
  MARK_READY: '标记备货完成',
  MARK_PAID: '确认已收款',
}

const choosePaymentMethod = (): Promise<PaymentMethod | undefined> =>
  new Promise((resolve) => {
    wx.showActionSheet({
      itemList: ['现金', '微信收款码'],
      success: ({ tapIndex }) => resolve(tapIndex === 0 ? 'CASH' : 'WECHAT_QR'),
      fail: () => resolve(undefined),
    })
  })

const requestCancelReason = (): Promise<string | undefined> =>
  new Promise((resolve) => {
    wx.showModal({
      title: '确认取消订单',
      content: '取消后无法恢复，请填写取消原因。',
      editable: true,
      placeholderText: '请输入取消原因',
      confirmText: '确认取消',
      success: (result) => resolve(
        result.confirm ? (result.content || '').trim() : undefined,
      ),
      fail: () => resolve(undefined),
    })
  })

Page({
  data: {
    orderNo: '',
    role: 'CASHIER' as MerchantRole,
    order: null as PresentedOrder | null,
    primaryAction: undefined as OrderPrimaryAction | undefined,
    primaryActionText: '',
    canCancel: false,
    isLoading: false,
    isMutating: false,
    errorMessage: '',
  },

  onLoad(options: Record<string, string | undefined>) {
    const orderNo = options.orderNo ? decodeURIComponent(options.orderNo) : ''
    this.setData({ orderNo })
  },

  onShow() {
    const session = merchantSessionStore.current()
    if (!session) {
      wx.reLaunch({ url: '/pages/login/index' })
      return
    }
    this.setData({ role: session.role })
    void this.reload(true)
  },

  applyOrder(order: MerchantOrder) {
    const primaryAction = availableOrderAction(
      order.status,
      this.data.role,
      order.paymentStatus,
    )
    this.setData({
      order: presentOrder(order),
      primaryAction,
      primaryActionText: primaryAction ? primaryActionLabel[primaryAction] : '',
      canCancel: canOwnerCancel(order.status, this.data.role),
    })
  },

  async reload(showLoading: boolean) {
    if (!this.data.orderNo) {
      this.setData({ errorMessage: '订单编号无效，请返回订单列表重试' })
      return
    }
    if (showLoading) this.setData({ isLoading: true, errorMessage: '' })
    try {
      this.applyOrder(await merchantOrdersService.detail(this.data.orderNo))
    } catch (error) {
      this.setData({ errorMessage: readableOrderError(error) })
    } finally {
      if (showLoading) this.setData({ isLoading: false })
    }
  },

  retry() {
    void this.reload(true)
  },

  async mutate(operation: () => Promise<MerchantOrder>, successMessage: string) {
    if (this.data.isMutating) return
    this.setData({ isMutating: true, errorMessage: '' })
    try {
      const updated = await operation()
      this.applyOrder(updated)
      this.getOpenerEventChannel().emit('orderUpdated', updated)
      wx.showToast({ title: successMessage, icon: 'success' })
      await this.reload(false)
    } catch (error) {
      this.setData({ errorMessage: readableOrderError(error) })
    } finally {
      this.setData({ isMutating: false })
    }
  },

  async runPrimaryAction() {
    const action = this.data.primaryAction
    if (!action || !this.data.order || this.data.isMutating) return
    if (action === 'ACCEPT') {
      await this.mutate(
        () => merchantOrdersService.accept(this.data.orderNo),
        '接单成功',
      )
      return
    }
    if (action === 'MARK_READY') {
      await this.mutate(
        () => merchantOrdersService.markReady(this.data.orderNo),
        '已标记备货完成',
      )
      return
    }
    const method = await choosePaymentMethod()
    if (!method) return
    await this.mutate(
      () => merchantOrdersService.markPaid(this.data.orderNo, method),
      '收款状态已更新',
    )
  },

  async cancelOrder() {
    if (!this.data.order || !canOwnerCancel(this.data.order.status, this.data.role)) return
    const reason = await requestCancelReason()
    if (!reason) {
      wx.showToast({ title: '请输入取消原因', icon: 'none' })
      return
    }
    await this.mutate(
      () => merchantOrdersService.cancel(this.data.orderNo, reason),
      '订单已取消',
    )
  },

  goBack() {
    wx.navigateBack()
  },
})
