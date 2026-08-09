import type { MerchantTab } from '../../components/app-tab-bar/navigation'
import { merchantSessionStore } from '../../store/session'

const COPY: Record<string, { title: string; description: string; tab: MerchantTab }> = {
  workbench: {
    title: '工作台建设中',
    description: '经营概览将在后续阶段上线。',
    tab: 'workbench',
  },
  orders: {
    title: '订单功能建设中',
    description: '商家订单处理将在后续阶段上线。',
    tab: 'orders',
  },
  verification: {
    title: '核销功能建设中',
    description: '取货码核销将在后续阶段上线。',
    tab: 'verification',
  },
  messages: {
    title: '消息功能建设中',
    description: '客服消息将在后续阶段上线。',
    tab: 'messages',
  },
  staff: {
    title: '员工管理建设中',
    description: '员工管理将在后续阶段上线。',
    tab: 'profile',
  },
}

Page({
  data: {
    title: COPY.messages.title,
    description: COPY.messages.description,
    tab: COPY.messages.tab,
  },

  onLoad(query: Record<string, string | undefined>) {
    if (!merchantSessionStore.current()) {
      wx.reLaunch({ url: '/pages/login/index' })
      return
    }
    this.setData(COPY[query.feature || 'messages'] || COPY.messages)
  },
})
