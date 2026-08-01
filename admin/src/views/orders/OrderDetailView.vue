<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import {
  acceptOrder,
  cancelOrder,
  completeOrder,
  getOrder,
  markOrderPaid,
  markOrderReady,
  rejectOrder,
  type AdminOrderDetail,
  type PaymentMethod,
} from '@/api/orders'
import { ApiError } from '@/api/http'
import { centToYuan } from '@/utils/money'
import { reportUnexpectedError } from '@/utils/errors'
import { formatDateTime } from '@/utils/date'
import { orderStatusLabel, paymentStatusLabel } from './orderPresentation'
import UiStatePanel from '@/components/UiStatePanel.vue'
import AppIcon from '@/components/AppIcon.vue'
import { ElMessage } from 'element-plus'
import {
  parseOrderListContext,
  serializeOrderListContext,
} from './orderListContext'

type MutationKind = 'accept' | 'reject' | 'ready' | 'pay' | 'complete' | 'cancel'

const props = withDefaults(
  defineProps<{
    orderNo: string
    returnQuery?: Record<string, unknown>
  }>(),
  {
    returnQuery: () => ({}),
  },
)
const backTarget = computed(() => ({
  name: 'orders',
  query: serializeOrderListContext(parseOrderListContext(props.returnQuery)),
}))
const order = ref<AdminOrderDetail>()
const loading = ref(false)
const loadError = ref('')
const dialogVisible = ref(false)
const pending = ref(false)
const mutationError = ref('')
const form = reactive<{
  kind: MutationKind
  reason: string
  paymentMethod: PaymentMethod
  pickupCode: string
}>({
  kind: 'accept',
  reason: '',
  paymentMethod: 'CASH',
  pickupCode: '',
})

const actionMeta: Record<MutationKind, { title: string; nextState: string }> = {
  accept: { title: '接单', nextState: '备货中' },
  reject: { title: '拒单', nextState: '已取消' },
  ready: { title: '备货完成', nextState: '待取货' },
  pay: { title: '确认线下付款', nextState: '已付款' },
  complete: { title: '完成订单', nextState: '已完成' },
  cancel: { title: '取消订单', nextState: '已取消' },
}

const requiresReason = computed(() => form.kind === 'reject' || form.kind === 'cancel')

const actorLabel = (actorType: 'CUSTOMER' | 'STAFF' | 'SYSTEM', actorId: number): string => {
  if (actorType === 'CUSTOMER') return '顾客'
  if (actorType === 'STAFF') return `员工 #${actorId}`
  return '系统'
}

const load = async (): Promise<void> => {
  loading.value = true
  loadError.value = ''
  try {
    order.value = await getOrder(props.orderNo)
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '订单详情加载失败'
    reportUnexpectedError(error, '订单详情加载失败')
  } finally {
    loading.value = false
  }
}

const openMutation = (kind: MutationKind): void => {
  form.kind = kind
  form.reason = ''
  form.paymentMethod = 'CASH'
  form.pickupCode = ''
  mutationError.value = ''
  dialogVisible.value = true
}

const executeMutation = async (): Promise<void> => {
  if (requiresReason.value && !form.reason.trim()) {
    mutationError.value = '请输入原因'
    return
  }
  if (form.kind === 'complete' && !/^\d{6}$/.test(form.pickupCode)) {
    mutationError.value = '请输入6位取货码'
    return
  }
  pending.value = true
  mutationError.value = ''
  try {
    const orderNo = props.orderNo
    let updatedOrder: AdminOrderDetail
    if (form.kind === 'accept') updatedOrder = await acceptOrder(orderNo)
    else if (form.kind === 'reject') {
      updatedOrder = await rejectOrder(orderNo, { reason: form.reason.trim() })
    } else if (form.kind === 'ready') updatedOrder = await markOrderReady(orderNo)
    else if (form.kind === 'pay') {
      updatedOrder = await markOrderPaid(orderNo, { method: form.paymentMethod })
    } else if (form.kind === 'complete') {
      updatedOrder = await completeOrder(orderNo, { pickupCode: form.pickupCode })
    }
    else updatedOrder = await cancelOrder(orderNo, { reason: form.reason.trim() })
    order.value = updatedOrder
    dialogVisible.value = false
    ElMessage.success(`${actionMeta[form.kind].title}已完成`)
  } catch (error) {
    mutationError.value =
      error instanceof ApiError || error instanceof Error ? error.message : '操作失败'
  } finally {
    pending.value = false
  }
}

onMounted(load)
</script>

<template>
  <section v-loading="loading" class="page-stack">
    <header class="page-header">
      <div>
        <RouterLink class="back-link" :to="backTarget">
          <AppIcon name="chevron-left" />返回订单列表
        </RouterLink>
        <p class="page-kicker">订单履约</p>
        <h1>订单 {{ props.orderNo }}</h1>
      </div>
      <div v-if="order" class="toolbar">
        <template v-if="order.status === 'PENDING_CONFIRMATION'">
          <el-button data-test="order-accept" type="primary" @click="openMutation('accept')">
            接单
          </el-button>
          <el-button data-test="order-reject" type="danger" @click="openMutation('reject')">
            拒单
          </el-button>
        </template>
        <template v-if="order.status === 'PREPARING'">
          <el-button data-test="order-ready" type="primary" @click="openMutation('ready')">
            备货完成
          </el-button>
          <el-button data-test="order-cancel" type="danger" @click="openMutation('cancel')">
            取消订单
          </el-button>
        </template>
        <template v-if="order.status === 'READY_FOR_PICKUP'">
          <el-button
            v-if="order.paymentStatus === 'UNPAID'"
            data-test="order-pay"
            type="success"
            @click="openMutation('pay')"
          >
            确认付款
          </el-button>
          <el-button
            v-if="order.paymentStatus === 'PAID'"
            data-test="order-complete"
            type="primary"
            @click="openMutation('complete')"
          >
            完成订单
          </el-button>
          <el-button data-test="order-cancel" type="danger" @click="openMutation('cancel')">
            取消订单
          </el-button>
        </template>
      </div>
    </header>

    <UiStatePanel
      v-if="!loading && loadError"
      class="surface-card"
      kind="error"
      title="订单详情加载失败"
      :description="loadError"
      action-label="重新加载"
      @action="load"
    />

    <template v-if="!loading && order">
      <article
        class="surface-card pickup-verification-card"
        data-test="pickup-verification-help"
      >
        <div>
          <span>取货码核销</span>
          <small>完成订单时，请输入顾客小程序中的6位取货码</small>
        </div>
      </article>
      <div class="summary-grid">
        <article class="surface-card">
          <span>订单状态</span>
          <strong>
            <span class="status-tag" :data-status="order.status">
              {{ orderStatusLabel[order.status] }}
            </span>
          </strong>
        </article>
        <article class="surface-card">
          <span>付款状态</span>
          <strong>
            <span class="status-tag" :data-payment-status="order.paymentStatus">
              {{ paymentStatusLabel[order.paymentStatus] }}
            </span>
          </strong>
        </article>
        <article class="surface-card">
          <span>取货人</span>
          <strong>{{ order.pickupName }} · {{ order.phone }}</strong>
        </article>
        <article class="surface-card">
          <span>订单金额</span>
          <strong>¥{{ centToYuan(order.totalCent) }}</strong>
        </article>
      </div>
      <div class="detail-grid">
        <div class="surface-card detail-main">
          <div class="section-heading">
            <div>
              <h2>商品明细</h2>
              <p>共 {{ order.items.length }} 种商品</p>
            </div>
          </div>
          <div class="responsive-table has-mobile-cards">
            <el-table :data="order.items">
              <el-table-column prop="productName" label="商品" />
              <el-table-column prop="unit" label="单位" width="90" />
              <el-table-column label="单价" width="120">
                <template #default="{ row }">¥{{ centToYuan(row.unitPriceCent) }}</template>
              </el-table-column>
              <el-table-column prop="quantity" label="数量" width="90" />
              <el-table-column label="小计" width="120">
                <template #default="{ row }">¥{{ centToYuan(row.subtotalCent) }}</template>
              </el-table-column>
            </el-table>
          </div>
          <div class="mobile-card-list order-item-cards" data-test="order-item-mobile-list">
            <article v-for="item in order.items" :key="item.productId" class="mobile-data-card">
              <div class="mobile-data-card__header">
                <strong>{{ item.productName }}</strong>
                <span class="price-text">¥{{ centToYuan(item.subtotalCent) }}</span>
              </div>
              <div class="mobile-data-card__row mobile-data-card__meta">
                <span>¥{{ centToYuan(item.unitPriceCent) }} / {{ item.unit }}</span>
                <span>× {{ item.quantity }}</span>
              </div>
            </article>
          </div>
          <dl class="amount-summary">
            <div>
              <dt>订单合计</dt>
              <dd>¥{{ centToYuan(order.totalCent) }}</dd>
            </div>
          </dl>
        </div>
        <div class="surface-card detail-side">
          <h2>取货信息</h2>
          <dl class="info-list">
            <div>
              <dt>取货门店</dt>
              <dd>鲁能超市李老家分店</dd>
            </div>
            <div>
              <dt>取货人</dt>
              <dd>{{ order.pickupName }}</dd>
            </div>
            <div>
              <dt>手机号</dt>
              <dd>{{ order.phone }}</dd>
            </div>
            <div>
              <dt>下单时间</dt>
              <dd>{{ formatDateTime(order.createdAt) }}</dd>
            </div>
            <div v-if="order.paymentMethod">
              <dt>付款方式</dt>
              <dd>{{ order.paymentMethod === 'CASH' ? '现金' : '门店微信收款码' }}</dd>
            </div>
            <div v-if="order.cancelReason">
              <dt>取消原因</dt>
              <dd>{{ order.cancelReason }}</dd>
            </div>
          </dl>
        </div>
        <div class="surface-card detail-history">
          <h2>状态记录</h2>
          <el-timeline>
            <el-timeline-item
              v-for="item in order.history"
              :key="`${item.toStatus}-${item.createdAt}`"
              :timestamp="formatDateTime(item.createdAt)"
            >
              {{ orderStatusLabel[item.toStatus] }} · {{ actorLabel(item.actorType, item.actorId) }}
              <p v-if="item.remark">{{ item.remark }}</p>
            </el-timeline-item>
          </el-timeline>
        </div>
      </div>
    </template>

    <el-dialog
      v-model="dialogVisible"
      :teleported="false"
      :title="actionMeta[form.kind].title"
      width="500"
      style="--dialog-width: 500px"
    >
      <p>
        订单 <strong>{{ props.orderNo }}</strong> 将变更为
        <strong>{{ actionMeta[form.kind].nextState }}</strong>
      </p>
      <div v-if="requiresReason" class="form-field">
        <label for="order-reason">原因</label>
        <textarea
          id="order-reason"
          v-model="form.reason"
          data-test="order-mutation-reason"
          class="text-control"
        />
        <p class="helper-text">原因会保留在订单状态记录中，请填写便于追溯的说明。</p>
      </div>
      <div v-if="form.kind === 'pay'" class="form-field">
        <label for="payment-method">付款方式</label>
        <select id="payment-method" v-model="form.paymentMethod" class="text-control">
          <option value="CASH">现金</option>
          <option value="WECHAT_QR">门店微信收款码</option>
        </select>
      </div>
      <div v-if="form.kind === 'complete'" class="form-field">
        <label for="pickup-code">顾客取货码</label>
        <input
          id="pickup-code"
          v-model="form.pickupCode"
          data-test="pickup-code-input"
          class="text-control pickup-code-input"
          inputmode="numeric"
          maxlength="6"
          placeholder="请输入6位取货码"
        />
        <p class="helper-text">请让顾客出示小程序订单详情中的取货码，核对无误后完成订单。</p>
      </div>
      <p v-if="mutationError" class="inline-alert" role="alert">{{ mutationError }}</p>
      <template #footer>
        <el-button :disabled="pending" @click="dialogVisible = false">取消</el-button>
        <el-button
          data-test="order-mutation-submit"
          :type="form.kind === 'reject' || form.kind === 'cancel' ? 'danger' : 'primary'"
          :loading="pending"
          :disabled="pending"
          @click="executeMutation"
        >
          确认变更
        </el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.pickup-verification-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-5);
  border: 1px solid var(--primary-200);
  background: linear-gradient(135deg, var(--primary-50), #fff);
}

.pickup-verification-card div {
  display: grid;
  gap: var(--space-2);
}

.pickup-verification-card span {
  color: var(--primary-800);
  font-size: var(--font-size-title);
  font-weight: 700;
}

.pickup-verification-card small {
  color: var(--color-text-secondary);
}

.pickup-code-input {
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.18em;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-4);
}

.summary-grid article {
  display: grid;
  gap: var(--space-2);
}

.summary-grid span {
  color: var(--color-text-secondary);
  font-size: 13px;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  margin-bottom: var(--space-3);
  text-decoration: none;
}
.detail-grid {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr);
  gap: var(--space-4);
}
.detail-main {
  grid-column: 1;
}
.detail-side {
  grid-column: 2;
}
.detail-history {
  grid-column: 1 / -1;
}
.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.section-heading h2 {
  margin-bottom: 0;
}
.section-heading p {
  margin: var(--space-1) 0 var(--space-4);
  color: var(--color-text-secondary);
}
.amount-summary {
  margin: 0;
  padding: var(--space-4) 0 0;
  border-top: 1px solid var(--color-divider);
}
.amount-summary div {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-6);
}
.amount-summary dd {
  margin: 0;
  color: var(--primary-800);
  font-size: var(--font-size-data);
  font-weight: 700;
}
.info-list {
  display: grid;
  gap: 0;
  margin: 0;
}
.info-list div {
  display: grid;
  gap: var(--space-1);
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--color-divider);
}
.info-list div:last-child {
  border-bottom: 0;
}
.info-list dt {
  color: var(--color-text-tertiary);
  font-size: var(--font-size-helper);
}
.info-list dd {
  margin: 0;
  font-weight: 500;
  overflow-wrap: anywhere;
}

@media (max-width: 960px) {
  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .detail-grid {
    grid-template-columns: 1fr;
  }
  .detail-main,
  .detail-side,
  .detail-history {
    grid-column: 1;
  }
}
@media (max-width: 560px) {
  .pickup-verification-card {
    align-items: flex-start;
    flex-direction: column;
  }
  .summary-grid {
    grid-template-columns: 1fr;
  }
}
</style>
