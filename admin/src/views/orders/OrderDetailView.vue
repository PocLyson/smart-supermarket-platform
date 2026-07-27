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
import { orderStatusLabel, paymentStatusLabel } from './orderPresentation'

type MutationKind = 'accept' | 'reject' | 'ready' | 'pay' | 'complete' | 'cancel'

const props = defineProps<{ orderNo: string }>()
const order = ref<AdminOrderDetail>()
const loading = ref(false)
const dialogVisible = ref(false)
const pending = ref(false)
const mutationError = ref('')
const form = reactive<{ kind: MutationKind; reason: string; paymentMethod: PaymentMethod }>({
  kind: 'accept',
  reason: '',
  paymentMethod: 'CASH',
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

const load = async (): Promise<void> => {
  loading.value = true
  try {
    order.value = await getOrder(props.orderNo)
  } catch (error) {
    reportUnexpectedError(error, '订单详情加载失败')
  } finally {
    loading.value = false
  }
}

const openMutation = (kind: MutationKind): void => {
  form.kind = kind
  form.reason = ''
  form.paymentMethod = 'CASH'
  mutationError.value = ''
  dialogVisible.value = true
}

const executeMutation = async (): Promise<void> => {
  if (requiresReason.value && !form.reason.trim()) {
    mutationError.value = '请输入原因'
    return
  }
  pending.value = true
  mutationError.value = ''
  try {
    const orderNo = props.orderNo
    if (form.kind === 'accept') await acceptOrder(orderNo)
    else if (form.kind === 'reject') await rejectOrder(orderNo, { reason: form.reason.trim() })
    else if (form.kind === 'ready') await markOrderReady(orderNo)
    else if (form.kind === 'pay')
      await markOrderPaid(orderNo, { paymentMethod: form.paymentMethod })
    else if (form.kind === 'complete') await completeOrder(orderNo)
    else await cancelOrder(orderNo, { reason: form.reason.trim() })
    dialogVisible.value = false
    await load()
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
        <RouterLink to="/orders">← 返回订单</RouterLink>
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

    <template v-if="order">
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
      <div class="surface-card">
        <h2>商品明细</h2>
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
      <div class="surface-card">
        <h2>状态记录</h2>
        <el-timeline>
          <el-timeline-item
            v-for="item in order.statusHistory"
            :key="`${item.toStatus}-${item.createdAt}`"
            :timestamp="item.createdAt"
          >
            {{ orderStatusLabel[item.toStatus] }} · {{ item.actorName }}
            <p v-if="item.remark">{{ item.remark }}</p>
          </el-timeline-item>
        </el-timeline>
      </div>
    </template>

    <el-dialog
      v-model="dialogVisible"
      :teleported="false"
      :title="actionMeta[form.kind].title"
      width="500"
    >
      <p>
        订单 <strong>{{ props.orderNo }}</strong> 将变更为
        <strong>{{ actionMeta[form.kind].nextState }}</strong>
      </p>
      <div v-if="requiresReason" class="form-field">
        <label>原因</label>
        <textarea v-model="form.reason" data-test="order-mutation-reason" class="text-control" />
      </div>
      <div v-if="form.kind === 'pay'" class="form-field">
        <label>付款方式</label>
        <select v-model="form.paymentMethod" class="text-control">
          <option value="CASH">现金</option>
          <option value="WECHAT_QR">门店微信收款码</option>
        </select>
      </div>
      <p v-if="mutationError" class="error-text">{{ mutationError }}</p>
      <template #footer>
        <el-button :disabled="pending" @click="dialogVisible = false">取消</el-button>
        <el-button
          data-test="order-mutation-submit"
          type="primary"
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

@media (max-width: 960px) {
  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
