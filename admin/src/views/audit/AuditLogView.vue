<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { listAuditLogs, type AuditLog, type AuditLogQuery } from '@/api/audit'
import { reportUnexpectedError } from '@/utils/errors'
import { formatDateTime } from '@/utils/date'
import UiStatePanel from '@/components/UiStatePanel.vue'
import AppIcon from '@/components/AppIcon.vue'

const items = ref<AuditLog[]>([])
const loading = ref(false)
const loadError = ref('')
const page = ref(1)
const pageSize = 20
const total = ref(0)
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
  loadError.value = ''
  try {
    const query: AuditLogQuery = {
      actorId: filters.actorId ? Number(filters.actorId) : undefined,
      action: filters.action.trim() || undefined,
      objectType: filters.objectType.trim() || undefined,
      page: page.value - 1,
      size: pageSize,
    }
    const result = await listAuditLogs(query)
    items.value = result.items
    total.value = result.total
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '审计记录加载失败'
    reportUnexpectedError(error, '审计记录加载失败')
  } finally {
    loading.value = false
  }
}

const search = async (): Promise<void> => {
  page.value = 1
  await load()
}
const reset = async (): Promise<void> => {
  Object.assign(filters, { actorId: '', action: '', objectType: '' })
  page.value = 1
  await load()
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
        <p class="page-kicker">安全与追溯</p>
        <h1>操作审计</h1>
        <p>按操作人、动作和业务对象检索关键变更记录。</p>
      </div>
      <el-button :loading="loading" @click="load"><AppIcon name="refresh" />刷新记录</el-button>
    </header>
    <form class="surface-card filter-panel" @submit.prevent="search">
      <div class="filter-field">
        <label for="audit-actor">操作人 ID</label>
        <input
          id="audit-actor"
          v-model="filters.actorId"
          data-test="audit-actor"
          class="text-control filter"
          inputmode="numeric"
          placeholder="例如 1"
        />
      </div>
      <div class="filter-field">
        <label for="audit-action">操作动作</label>
        <input
          id="audit-action"
          v-model="filters.action"
          data-test="audit-action"
          class="text-control filter"
          placeholder="动作"
        />
      </div>
      <div class="filter-field is-wide">
        <label for="audit-object">业务对象</label>
        <input
          id="audit-object"
          v-model="filters.objectType"
          data-test="audit-object-type"
          class="text-control filter"
          placeholder="业务对象"
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
        <span>共 {{ total }} 条关键操作记录</span><span>记录按服务器时间展示</span>
      </div>
      <div v-if="loading" class="skeleton-stack">
        <div v-for="i in 8" :key="i" class="skeleton-row" />
      </div>
      <UiStatePanel
        v-else-if="loadError"
        kind="error"
        title="审计记录加载失败"
        :description="loadError"
        action-label="重新加载"
        @action="load"
      />
      <UiStatePanel
        v-else-if="!items.length"
        kind="empty"
        title="当前条件没有审计记录"
        description="可调整操作人、动作或业务对象后重新查询。"
        action-label="清除筛选"
        @action="reset"
      />
      <div v-else class="responsive-table">
        <el-table :data="items">
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

<style scoped></style>
