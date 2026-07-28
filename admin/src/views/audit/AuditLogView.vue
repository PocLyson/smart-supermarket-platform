<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { listAuditLogs, type AuditLog, type AuditLogQuery } from '@/api/audit'
import { reportUnexpectedError } from '@/utils/errors'
import { formatDateTime } from '@/utils/date'

const items = ref<AuditLog[]>([])
const loading = ref(false)
const filters = reactive({ actorId: '', action: '', objectType: '' })

const actionLabels: Record<string, string> = {
  ORDER_ACCEPT: '接单',
  ORDER_REJECT: '拒单',
  ORDER_READY: '备货完成',
  ORDER_PAY: '确认付款',
  ORDER_COMPLETE: '完成订单',
  ORDER_CANCEL: '取消订单',
  PRODUCT_CREATE: '新增商品',
  PRODUCT_UPDATE: '更新商品',
  PRODUCT_SHELF: '商品上下架',
  CATEGORY_CREATE: '新增分类',
  CATEGORY_UPDATE: '更新分类',
  INVENTORY_ADJUST: '调整库存',
  STAFF_CREATE: '新增收银员',
  STAFF_ENABLE: '启用员工',
  STAFF_DISABLE: '停用员工',
  STAFF_RESET_PASSWORD: '重置员工密码',
}

const objectLabels: Record<string, string> = {
  ORDER: '订单',
  PRODUCT: '商品',
  CATEGORY: '分类',
  STAFF: '员工',
}

const summaryLabels: Record<string, string> = {
  PENDING_CONFIRMATION: '待门店确认',
  PREPARING: '备货中',
  READY_FOR_PICKUP: '待取货',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
  CASH: '现金',
  WECHAT_QR: '门店微信收款码',
}

const actorLabel = (row: AuditLog): string => {
  if (row.actorType === 'STAFF') return `员工 #${row.actorId}`
  if (row.actorType === 'CUSTOMER') return `顾客 #${row.actorId}`
  return '系统'
}

const load = async (): Promise<void> => {
  loading.value = true
  try {
    const query: AuditLogQuery = {
      actorId: filters.actorId ? Number(filters.actorId) : undefined,
      action: filters.action.trim() || undefined,
      objectType: filters.objectType.trim() || undefined,
      page: 0,
      size: 20,
    }
    items.value = (await listAuditLogs(query)).items
  } catch (error) {
    reportUnexpectedError(error, '审计记录加载失败')
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
        <h1>操作审计</h1>
        <p>按操作人、动作和业务对象检索关键变更记录。</p>
      </div>
    </header>
    <form class="surface-card toolbar" @submit.prevent="load">
      <input
        v-model="filters.actorId"
        data-test="audit-actor"
        class="text-control filter"
        inputmode="numeric"
        placeholder="操作人 ID"
      />
      <input
        v-model="filters.action"
        data-test="audit-action"
        class="text-control filter"
        placeholder="动作"
      />
      <input
        v-model="filters.objectType"
        data-test="audit-object-type"
        class="text-control filter"
        placeholder="业务对象"
      />
      <el-button native-type="submit" type="primary" :loading="loading">查询</el-button>
    </form>
    <div class="surface-card">
      <el-table v-loading="loading" :data="items">
        <el-table-column label="时间" min-width="180">
          <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作人" min-width="120">
          <template #default="{ row }">{{ actorLabel(row) }}</template>
        </el-table-column>
        <el-table-column label="动作" min-width="150">
          <template #default="{ row }">{{ actionLabels[row.action] ?? row.action }}</template>
        </el-table-column>
        <el-table-column label="业务对象" min-width="160">
          <template #default="{ row }">
            {{ objectLabels[row.objectType] ?? row.objectType }} · {{ row.objectId }}
          </template>
        </el-table-column>
        <el-table-column label="结果摘要" min-width="180">
          <template #default="{ row }">
            {{ summaryLabels[row.resultSummary] ?? row.resultSummary }}
          </template>
        </el-table-column>
        <el-table-column prop="requestId" label="请求 ID" min-width="180" />
      </el-table>
    </div>
  </section>
</template>

<style scoped>
.filter {
  width: 190px;
}
</style>
