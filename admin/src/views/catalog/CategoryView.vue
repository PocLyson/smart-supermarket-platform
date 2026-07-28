<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  createCategory,
  listCategories,
  updateCategory,
  type Category,
  type CategoryWriteRequest,
} from '@/api/catalog'
import { reportUnexpectedError } from '@/utils/errors'
import UiStatePanel from '@/components/UiStatePanel.vue'
import AppIcon from '@/components/AppIcon.vue'

const categories = ref<Category[]>([])
const dialogVisible = ref(false)
const pending = ref(false)
const loading = ref(false)
const loadError = ref('')
const formError = ref('')
const editingId = ref<number>()
const form = reactive<CategoryWriteRequest>({ name: '', sortOrder: 0, enabled: true })

const load = async (): Promise<void> => {
  loading.value = true
  loadError.value = ''
  try {
    categories.value = await listCategories()
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '分类加载失败'
    reportUnexpectedError(error, '分类加载失败')
  } finally {
    loading.value = false
  }
}

const openEditor = (category?: Category): void => {
  editingId.value = category?.id
  Object.assign(form, {
    name: category?.name ?? '',
    sortOrder: category?.sortOrder ?? 0,
    enabled: category?.enabled ?? true,
  })
  dialogVisible.value = true
  formError.value = ''
}

const submit = async (): Promise<void> => {
  if (!form.name.trim()) {
    formError.value = '请输入分类名称'
    return
  }
  pending.value = true
  formError.value = ''
  try {
    const payload = { ...form, name: form.name.trim() }
    if (editingId.value) await updateCategory(editingId.value, payload)
    else await createCategory(payload)
    dialogVisible.value = false
    await load()
    ElMessage.success('分类已保存')
  } catch (error) {
    formError.value = error instanceof Error ? error.message : '分类保存失败'
    reportUnexpectedError(error, '分类保存失败')
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
        <p class="page-kicker">商品与售卖</p>
        <h1>分类管理</h1>
        <p>维护小程序中可见的商品分类、顺序与启用状态。</p>
      </div>
      <el-button type="primary" @click="openEditor()"><AppIcon name="plus" />新增分类</el-button>
    </header>
    <div class="surface-card data-region">
      <div class="data-region__summary">
        <span>共 {{ categories.length }} 个分类</span><span>排序数字越小越靠前</span>
      </div>
      <div v-if="loading" class="skeleton-stack">
        <div v-for="i in 6" :key="i" class="skeleton-row" />
      </div>
      <UiStatePanel
        v-else-if="loadError"
        kind="error"
        title="分类加载失败"
        :description="loadError"
        action-label="重新加载"
        @action="load"
      />
      <UiStatePanel
        v-else-if="!categories.length"
        kind="empty"
        title="还没有商品分类"
        description="先创建分类，再为商品选择所属分类。"
        action-label="新增分类"
        @action="openEditor()"
      />
      <div v-else class="responsive-table">
        <el-table :data="categories">
          <el-table-column prop="name" label="分类名称" />
          <el-table-column prop="sortOrder" label="排序" width="100" />
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="row.enabled ? 'success' : 'info'">
                {{ row.enabled ? '启用' : '停用' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="100">
            <template #default="{ row }">
              <el-button link type="primary" @click="openEditor(row)">编辑</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>
    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑分类' : '新增分类'" width="460">
      <div class="form-grid">
        <div class="form-field">
          <label for="category-name">分类名称</label>
          <input id="category-name" v-model="form.name" class="text-control" :disabled="pending" />
          <p v-if="formError && !form.name.trim()" class="error-text" role="alert">
            {{ formError }}
          </p>
        </div>
        <div class="form-field">
          <label for="category-sort">排序</label>
          <input
            id="category-sort"
            v-model.number="form.sortOrder"
            class="text-control"
            type="number"
            :disabled="pending"
          />
          <p class="helper-text">建议使用 10、20、30，便于后续插入新分类。</p>
        </div>
        <el-switch v-model="form.enabled" active-text="启用" inactive-text="停用" />
        <p v-if="formError && form.name.trim()" class="inline-alert" role="alert">
          {{ formError }}
        </p>
      </div>
      <template #footer>
        <el-button :disabled="pending" @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="pending" :disabled="pending" @click="submit">
          保存分类
        </el-button>
      </template>
    </el-dialog>
  </section>
</template>
