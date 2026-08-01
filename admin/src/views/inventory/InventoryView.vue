<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { listCategories, type Category } from '@/api/catalog'
import {
  adjustInventory,
  listInventory,
  type InventoryItem,
  type InventoryAdjustmentRequest,
  type InventoryStockStatus,
} from '@/api/inventory'
import { reportUnexpectedError } from '@/utils/errors'
import { formatDateTime } from '@/utils/date'
import UiStatePanel from '@/components/UiStatePanel.vue'
import AppIcon from '@/components/AppIcon.vue'

const items = ref<InventoryItem[]>([])
const dialogVisible = ref(false)
const pending = ref(false)
const selected = ref<InventoryItem>()
const form = reactive<{ delta: string; reason: string }>({ delta: '', reason: '' })
const errorMessage = ref('')
const loading = ref(false)
const loadError = ref('')
const keyword = ref('')
const categories = ref<Category[]>([])
const categoryId = ref('')
const stockStatus = ref<InventoryStockStatus | ''>('')
const hasActiveFilters = computed(
  () => Boolean(keyword.value.trim()) || Boolean(categoryId.value) || Boolean(stockStatus.value),
)
const filteredItems = computed(() => {
  const value = keyword.value.trim().toLowerCase()
  return value
    ? items.value.filter((item) => item.productName.toLowerCase().includes(value))
    : items.value
})

const load = async (): Promise<void> => {
  loading.value = true
  loadError.value = ''
  try {
    items.value = (
      await listInventory({
        categoryId: categoryId.value ? Number(categoryId.value) : undefined,
        stockStatus: stockStatus.value || undefined,
      })
    ).items
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '库存加载失败'
    reportUnexpectedError(error, '库存加载失败')
  } finally {
    loading.value = false
  }
}

const loadCategories = async (): Promise<void> => {
  try {
    categories.value = await listCategories()
  } catch (error) {
    reportUnexpectedError(error, '分类加载失败')
  }
}

const resetFilters = (): void => {
  keyword.value = ''
  categoryId.value = ''
  stockStatus.value = ''
}

const stockLabel = (quantity: number): string => {
  if (quantity === 0) return '无库存'
  if (quantity <= 5) return '库存较低'
  return '库存正常'
}

const stockTagStatus = (quantity: number): string => {
  if (quantity === 0) return 'CANCELLED'
  if (quantity <= 5) return 'PREPARING'
  return 'COMPLETED'
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

watch([categoryId, stockStatus], load)
onMounted(() => {
  void load()
  void loadCategories()
})
</script>

<template>
  <section class="page-stack">
    <header class="page-header">
      <div>
        <p class="page-kicker">商品与售卖</p>
        <h1>线上库存</h1>
        <p>此处仅管理小程序可售数量，不会自动同步线下收银库存。</p>
      </div>
      <el-button :loading="loading" @click="load"><AppIcon name="refresh" />刷新库存</el-button>
    </header>
    <div class="inventory-note">
      <strong>仅影响线上可售数量</strong>
      <span>这里的调整不会同步线下收银库存；减少库存时请确认调整后数量不会小于 0。</span>
    </div>
    <form class="surface-card filter-panel" @submit.prevent>
      <div class="filter-field is-wide">
        <label for="inventory-keyword">查找商品</label>
        <input
          id="inventory-keyword"
          v-model="keyword"
          class="text-control"
          placeholder="输入商品名称"
        />
      </div>
      <div class="filter-field">
        <label for="inventory-category">商品分类</label>
        <select
          id="inventory-category"
          v-model="categoryId"
          class="text-control"
          data-test="inventory-category"
        >
          <option value="">全部分类</option>
          <option v-for="category in categories" :key="category.id" :value="String(category.id)">
            {{ category.name }}
          </option>
        </select>
      </div>
      <div class="filter-field">
        <label for="inventory-stock-status">库存状态</label>
        <select
          id="inventory-stock-status"
          v-model="stockStatus"
          class="text-control"
          data-test="inventory-stock-status"
        >
          <option value="">全部库存</option>
          <option value="IN_STOCK">有库存</option>
          <option value="LOW_STOCK">库存较低（1–5）</option>
          <option value="OUT_OF_STOCK">无库存</option>
        </select>
      </div>
      <div class="filter-actions">
        <el-button native-type="button" :disabled="!hasActiveFilters" @click="resetFilters">
          清除筛选
        </el-button>
      </div>
    </form>
    <div class="surface-card data-region">
      <div class="data-region__summary">
        <span>共 {{ filteredItems.length }} 件商品</span><span>库存数量以商品单位计</span>
      </div>
      <div v-if="loading" class="skeleton-stack">
        <div v-for="i in 8" :key="i" class="skeleton-row" />
      </div>
      <UiStatePanel
        v-else-if="loadError"
        kind="error"
        title="库存加载失败"
        :description="loadError"
        action-label="重新加载"
        @action="load"
      />
      <UiStatePanel
        v-else-if="!filteredItems.length"
        kind="empty"
        :title="hasActiveFilters ? '没有符合条件的商品' : '还没有线上库存记录'"
        :description="hasActiveFilters ? '请调整分类、库存状态或商品名称。' : '商品创建后会显示在这里。'"
        :action-label="hasActiveFilters ? '清除筛选' : '刷新'"
        @action="hasActiveFilters ? resetFilters() : load()"
      />
      <div v-else class="responsive-table has-mobile-cards">
        <el-table :data="filteredItems">
          <el-table-column prop="productName" label="商品" min-width="200" />
          <el-table-column prop="categoryName" label="分类" min-width="140" />
          <el-table-column label="可售库存" width="150" align="right">
            <template #default="{ row }">
              <strong class="stock-number">{{ row.availableQuantity }}</strong>
              {{ row.unit }}
            </template>
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
      <div
        v-if="!loading && !loadError && filteredItems.length"
        class="mobile-card-list"
        data-test="inventory-mobile-list"
      >
        <article v-for="item in filteredItems" :key="item.productId" class="mobile-data-card">
          <div class="mobile-data-card__header">
            <strong>{{ item.productName }}</strong>
            <span class="status-tag" :data-status="stockTagStatus(item.availableQuantity)">
              {{ stockLabel(item.availableQuantity) }}
            </span>
          </div>
          <span class="mobile-data-card__meta">{{ item.categoryName }}</span>
          <div class="mobile-data-card__row">
            <span class="mobile-data-card__meta">线上可售库存</span>
            <strong class="stock-number">{{ item.availableQuantity }} {{ item.unit }}</strong>
          </div>
          <div class="mobile-data-card__footer">
            <span class="mobile-data-card__meta">{{ formatDateTime(item.updatedAt) }}</span>
            <el-button type="primary" @click="openAdjustment(item)">调整库存</el-button>
          </div>
        </article>
      </div>
    </div>
    <el-dialog
      v-model="dialogVisible"
      :title="selected ? `调整 ${selected.productName} 库存` : '调整库存'"
      width="480"
    >
      <div class="form-grid">
        <div v-if="selected" class="current-stock">
          <span>当前线上库存</span
          ><strong>{{ selected.availableQuantity }} {{ selected.unit }}</strong>
        </div>
        <div class="form-field">
          <label for="adjust-delta">调整数量</label>
          <input
            id="adjust-delta"
            v-model="form.delta"
            data-test="adjust-delta"
            class="text-control"
            type="number"
            step="1"
          />
          <p class="helper-text">增加填正数，减少填负数，例如补货 10 件填写 10。</p>
        </div>
        <div class="form-field">
          <label for="adjust-reason">调整原因</label>
          <input
            id="adjust-reason"
            v-model="form.reason"
            data-test="adjust-reason"
            class="text-control"
            placeholder="例如：门店补货入库"
          />
        </div>
        <p v-if="errorMessage" class="inline-alert" role="alert">{{ errorMessage }}</p>
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

<style scoped>
.inventory-note {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--warning-border);
  border-radius: var(--radius-md);
  color: var(--warning-text);
  background: var(--warning-bg);
}
.inventory-note span {
  color: var(--color-text-secondary);
}
.stock-number {
  font-size: var(--font-size-card-title);
  font-variant-numeric: tabular-nums;
}
.current-stock {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3);
  border-radius: var(--radius-md);
  background: var(--color-bg-subtle);
}
@media (max-width: 760px) {
  .inventory-note {
    flex-direction: column;
  }
}
</style>
