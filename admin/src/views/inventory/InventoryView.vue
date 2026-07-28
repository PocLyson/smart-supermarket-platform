<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  adjustInventory,
  listInventory,
  type InventoryItem,
  type InventoryAdjustmentRequest,
} from '@/api/inventory'
import { reportUnexpectedError } from '@/utils/errors'
import { formatDateTime } from '@/utils/date'

const items = ref<InventoryItem[]>([])
const dialogVisible = ref(false)
const pending = ref(false)
const selected = ref<InventoryItem>()
const form = reactive<{ delta: string; reason: string }>({ delta: '', reason: '' })
const errorMessage = ref('')

const load = async (): Promise<void> => {
  try {
    items.value = (await listInventory()).items
  } catch (error) {
    reportUnexpectedError(error, '库存加载失败')
  }
}

const openAdjustment = (item: InventoryItem): void => {
  selected.value = item
  form.delta = ''
  form.reason = ''
  errorMessage.value = ''
  dialogVisible.value = true
}

const submit = async (): Promise<void> => {
  const delta = Number(form.delta)
  if (!Number.isInteger(delta) || delta === 0) {
    errorMessage.value = '调整数量必须是非零整数'
    return
  }
  if (!form.reason.trim()) {
    errorMessage.value = '请输入调整原因'
    return
  }
  pending.value = true
  errorMessage.value = ''
  try {
    const payload: InventoryAdjustmentRequest = { delta, reason: form.reason.trim() }
    await adjustInventory(selected.value!.productId, payload)
    dialogVisible.value = false
    await load()
    ElMessage.success('库存已调整')
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '库存调整失败'
  } finally {
    pending.value = false
  }
}

onMounted(load)
</script>

<template>
  <section class="page-stack">
    <header class="page-header">
      <div>
        <h1>线上库存</h1>
        <p>此处仅管理小程序可售数量，不会自动同步线下收银库存。</p>
      </div>
    </header>
    <div class="surface-card">
      <el-table :data="items">
        <el-table-column prop="productName" label="商品" min-width="200" />
        <el-table-column label="可售库存" width="150">
          <template #default="{ row }">{{ row.availableQuantity }} {{ row.unit }}</template>
        </el-table-column>
        <el-table-column label="更新时间" min-width="180">
          <template #default="{ row }">{{ formatDateTime(row.updatedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-button
              :data-test="`adjust-${row.productId}`"
              link
              type="primary"
              @click="openAdjustment(row)"
            >
              调整库存
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
    <el-dialog
      v-model="dialogVisible"
      :title="selected ? `调整 ${selected.productName} 库存` : '调整库存'"
      width="480"
    >
      <div class="form-grid">
        <div class="form-field">
          <label>调整数量（增加填正数，减少填负数）</label>
          <input
            v-model="form.delta"
            data-test="adjust-delta"
            class="text-control"
            type="number"
            step="1"
          />
        </div>
        <div class="form-field">
          <label>调整原因</label>
          <input v-model="form.reason" data-test="adjust-reason" class="text-control" />
        </div>
        <p v-if="errorMessage" class="error-text">{{ errorMessage }}</p>
      </div>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button data-test="adjust-submit" type="primary" :loading="pending" @click="submit">
          确认调整
        </el-button>
      </template>
    </el-dialog>
  </section>
</template>
