<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import {
  listOrders,
  type AdminOrderQuery,
  type AdminOrderSummary,
  type OrderStatus,
  type PaymentStatus,
} from '@/api/orders'
import { centToYuan } from '@/utils/money'
import { reportUnexpectedError } from '@/utils/errors'
import { orderStatusLabel, paymentStatusLabel } from './orderPresentation'
import { formatDateTime } from '@/utils/date'
import UiStatePanel from '@/components/UiStatePanel.vue'
import AppIcon from '@/components/AppIcon.vue'

const items = ref<AdminOrderSummary[]>([])
const loading = ref(false)
const loadError = ref('')
const total = ref(0)
const page = ref(1)
const pageSize = 20
const filters = reactive<{
  status: '' | OrderStatus
  paymentStatus: '' | PaymentStatus
  keyword: string
}>({
  status: '',
  paymentStatus: '',
  keyword: '',
})

const statusText = (status: OrderStatus): string => orderStatusLabel[status]
const paymentText = (status: PaymentStatus): string => paymentStatusLabel[status]

const load = async (): Promise<void> => {
  loading.value = true
  loadError.value = ''
  try {
    const query: AdminOrderQuery = {
      status: filters.status || undefined,
      paymentStatus: filters.paymentStatus || undefined,
      keyword: filters.keyword.trim() || undefined,
      page: page.value - 1,
      size: pageSize,
    }
    const result = await listOrders(query)
    items.value = result.items
    total.value = result.total
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '订单加载失败'
    reportUnexpectedError(error, '订单加载失败')
  } finally {
    loading.value = false
  }
}

const search = async (): Promise<void> => {
  page.value = 1
  await load()
}

const reset = async (): Promise<void> => {
  Object.assign(filters, { status: '', paymentStatus: '', keyword: '' })
  page.value = 1
  await load()
}

const selectStatus = async (status: '' | OrderStatus): Promise<void> => {
  filters.status = status
  await search()
}

const changePage = async (value: number): Promise<void> => {
  page.value = value
  await load()
}

onMounted(load)
</script>

<template>
  <section class="page-stack">
    <header class="page-header">
      <div>
        <p class="page-kicker">门店履约</p>
        <h1>订单管理</h1>
        <p>按订单号、取货人或手机号查找，并跟进门店履约。</p>
      </div>
      <el-button :loading="loading" @click="load"><AppIcon name="refresh" />刷新订单</el-button>
    </header>
    <div class="status-tabs" role="tablist" aria-label="按订单状态筛选">
      <button
        v-for="option in [
          ['', '全部'],
          ['PENDING_CONFIRMATION', '待门店确认'],
          ['PREPARING', '备货中'],
          ['READY_FOR_PICKUP', '待取货'],
          ['COMPLETED', '已完成'],
          ['CANCELLED', '已取消'],
        ]"
        :key="option[0]"
        type="button"
        role="tab"
        :aria-selected="filters.status === option[0]"
        :class="{ active: filters.status === option[0] }"
        @click="selectStatus(option[0] as '' | OrderStatus)"
      >
        {{ option[1] }}
      </button>
    </div>
    <form class="surface-card filter-panel" @submit.prevent="search">
      <div class="filter-field">
        <label for="order-status">订单状态</label>
        <select
          id="order-status"
          v-model="filters.status"
          data-test="order-status-filter"
          class="text-control"
        >
          <option value="">全部订单状态</option>
          <option value="PENDING_CONFIRMATION">待门店确认</option>
          <option value="PREPARING">备货中</option>
          <option value="READY_FOR_PICKUP">待取货</option>
          <option value="COMPLETED">已完成</option>
          <option value="CANCELLED">已取消</option>
        </select>
      </div>
      <div class="filter-field">
        <label for="payment-status">付款状态</label>
        <select
          id="payment-status"
          v-model="filters.paymentStatus"
          data-test="payment-status-filter"
          class="text-control"
        >
          <option value="">全部付款状态</option>
          <option value="UNPAID">未付款</option>
          <option value="PAID">已付款</option>
        </select>
      </div>
      <div class="filter-field is-wide">
        <label for="order-keyword">关键词</label>
        <input
          id="order-keyword"
          v-model="filters.keyword"
          data-test="order-keyword-filter"
          class="text-control"
          placeholder="订单号 / 取货人 / 手机号"
        />
      </div>
      <div class="filter-actions">
        <el-button native-type="button" @click="reset">重置</el-button>
        <el-button native-type="submit" type="primary" :loading="loading">
          <AppIcon name="search" />查询
        </el-button>
      </div>
    </form>
    <div class="surface-card data-region">
      <div class="data-region__summary">
        <span>共 {{ total }} 笔订单</span><span>按下单时间由新到旧</span>
      </div>
      <div v-if="loading" class="skeleton-stack" aria-label="订单加载中">
        <div v-for="index in 8" :key="index" class="skeleton-row" />
      </div>
      <UiStatePanel
        v-else-if="loadError"
        kind="error"
        title="订单加载失败"
        :description="loadError"
        action-label="重新加载"
        @action="load"
      />
      <UiStatePanel
        v-else-if="!items.length"
        kind="empty"
        :title="
          filters.status || filters.paymentStatus || filters.keyword
            ? '当前筛选没有结果'
            : '还没有订单'
        "
        :description="
          filters.status || filters.paymentStatus || filters.keyword
            ? '请调整筛选条件后重试。'
            : '顾客提交订单后会显示在这里。'
        "
        :action-label="
          filters.status || filters.paymentStatus || filters.keyword ? '清除筛选' : '刷新'
        "
        @action="filters.status || filters.paymentStatus || filters.keyword ? reset() : load()"
      />
      <div v-else class="responsive-table">
        <el-table :data="items">
          <el-table-column prop="orderNo" label="订单号" min-width="160" />
          <el-table-column label="下单时间" min-width="150">
            <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
          </el-table-column>
          <el-table-column label="取货信息" min-width="135">
            <template #default="{ row }">
              <div>{{ row.pickupName }}</div>
              <small>{{ row.phone }}</small>
            </template>
          </el-table-column>
          <el-table-column label="金额" width="105" align="right">
            <template #default="{ row }">¥{{ centToYuan(row.totalCent) }}</template>
          </el-table-column>
          <el-table-column label="订单状态" width="105">
            <template #default="{ row }">
              <span class="status-tag" :data-status="row.status">{{ statusText(row.status) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="付款状态" width="90">
            <template #default="{ row }">
              <span class="status-tag" :data-payment-status="row.paymentStatus">
                {{ paymentText(row.paymentStatus) }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="80">
            <template #default="{ row }">
              <RouterLink :to="`/orders/${row.orderNo}`">查看详情</RouterLink>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <div v-if="!loading && !loadError && total > 0" class="pagination-bar">
        <span>第 {{ page }} 页，每页 {{ pageSize }} 条</span>
        <el-pagination
          :current-page="page"
          :page-size="pageSize"
          :total="total"
          layout="prev, pager, next"
          @current-change="changePage"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
small {
  color: var(--color-text-secondary);
}

.status-tabs {
  display: flex;
  gap: var(--space-1);
  padding: var(--space-1);
  overflow-x: auto;
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-md);
  background: var(--color-bg-surface);
}
.status-tabs button {
  flex: 0 0 auto;
  min-height: 36px;
  padding: 0 var(--space-3);
  border: 0;
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  background: transparent;
  cursor: pointer;
}
.status-tabs button:hover {
  background: var(--color-bg-subtle);
}
.status-tabs button.active {
  color: var(--primary-800);
  background: var(--primary-100);
  font-weight: 600;
}
@media (max-width: 760px) {
  .status-tabs button {
    min-height: 44px;
  }
}
</style>
