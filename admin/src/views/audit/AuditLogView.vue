<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { listAuditLogs, type AuditLog, type AuditLogQuery } from '@/api/audit'
import { reportUnexpectedError } from '@/utils/errors'

const items = ref<AuditLog[]>([])
const loading = ref(false)
const filters = reactive({ actorId: '', action: '', objectType: '' })

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
        <el-table-column prop="createdAt" label="时间" min-width="180" />
        <el-table-column prop="actorName" label="操作人" min-width="120" />
        <el-table-column prop="action" label="动作" min-width="150" />
        <el-table-column label="业务对象" min-width="160">
          <template #default="{ row }">{{ row.objectType }} · {{ row.objectId }}</template>
        </el-table-column>
        <el-table-column prop="resultSummary" label="结果摘要" min-width="180" />
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
