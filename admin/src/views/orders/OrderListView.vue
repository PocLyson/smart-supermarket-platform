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
import { orderStatusLabel, paymentStatusLabel } from './orderPresentation'

const items = ref<AdminOrderSummary[]>([])
const loading = ref(false)
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
  try {
    const query: AdminOrderQuery = {
      status: filters.status || undefined,
      paymentStatus: filters.paymentStatus || undefined,
      keyword: filters.keyword.trim() || undefined,
      page: 0,
      size: 20,
    }
    items.value = (await listOrders(query)).items
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <section class="page-stack">
    <header class="page-header">
      <div>
        <h1>订单处理</h1>
        <p>按订单号、取货人或手机号查找，并跟进门店履约。</p>
      </div>
    </header>
    <form class="surface-card toolbar" @submit.prevent="load">
      <select v-model="filters.status" data-test="order-status-filter" class="text-control filter">
        <option value="">全部订单状态</option>
        <option value="PENDING_CONFIRMATION">待门店确认</option>
        <option value="PREPARING">备货中</option>
        <option value="READY_FOR_PICKUP">待取货</option>
        <option value="COMPLETED">已完成</option>
        <option value="CANCELLED">已取消</option>
      </select>
      <select
        v-model="filters.paymentStatus"
        data-test="payment-status-filter"
        class="text-control filter"
      >
        <option value="">全部付款状态</option>
        <option value="UNPAID">未付款</option>
        <option value="PAID">已付款</option>
      </select>
      <input
        v-model="filters.keyword"
        data-test="order-keyword-filter"
        class="text-control keyword"
        placeholder="订单号 / 取货人 / 手机号"
      />
      <el-button native-type="submit" type="primary" :loading="loading">查询</el-button>
    </form>
    <div class="surface-card">
      <el-table v-loading="loading" :data="items">
        <el-table-column prop="orderNo" label="订单号" min-width="180" />
        <el-table-column label="取货信息" min-width="180">
          <template #default="{ row }">
            <div>{{ row.pickupName }}</div>
            <small>{{ row.phone }}</small>
          </template>
        </el-table-column>
        <el-table-column label="金额" width="110">
          <template #default="{ row }">¥{{ centToYuan(row.totalCent) }}</template>
        </el-table-column>
        <el-table-column label="订单状态" width="130">
          <template #default="{ row }">{{ statusText(row.status) }}</template>
        </el-table-column>
        <el-table-column label="付款状态" width="110">
          <template #default="{ row }">{{ paymentText(row.paymentStatus) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="100">
          <template #default="{ row }">
            <RouterLink :to="`/orders/${row.orderNo}`">查看详情</RouterLink>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </section>
</template>

<style scoped>
.filter {
  width: 180px;
}

.keyword {
  width: 260px;
}

small {
  color: var(--color-text-secondary);
}
</style>
