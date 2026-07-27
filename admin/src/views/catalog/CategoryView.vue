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

const categories = ref<Category[]>([])
const dialogVisible = ref(false)
const pending = ref(false)
const editingId = ref<number>()
const form = reactive<CategoryWriteRequest>({ name: '', sortOrder: 0, enabled: true })

const load = async (): Promise<void> => {
  categories.value = await listCategories()
}

const openEditor = (category?: Category): void => {
  editingId.value = category?.id
  Object.assign(form, {
    name: category?.name ?? '',
    sortOrder: category?.sortOrder ?? 0,
    enabled: category?.enabled ?? true,
  })
  dialogVisible.value = true
}

const submit = async (): Promise<void> => {
  if (!form.name.trim()) {
    ElMessage.error('请输入分类名称')
    return
  }
  pending.value = true
  try {
    const payload = { ...form, name: form.name.trim() }
    if (editingId.value) await updateCategory(editingId.value, payload)
    else await createCategory(payload)
    dialogVisible.value = false
    await load()
    ElMessage.success('分类已保存')
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
        <h1>分类管理</h1>
        <p>维护小程序中可见的商品分类、顺序与启用状态。</p>
      </div>
      <el-button type="primary" @click="openEditor()">新增分类</el-button>
    </header>
    <div class="surface-card">
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
    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑分类' : '新增分类'" width="460">
      <div class="form-grid">
        <div class="form-field">
          <label>分类名称</label>
          <input v-model="form.name" class="text-control" />
        </div>
        <div class="form-field">
          <label>排序</label>
          <input v-model.number="form.sortOrder" class="text-control" type="number" />
        </div>
        <el-switch v-model="form.enabled" active-text="启用" inactive-text="停用" />
      </div>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="pending" @click="submit">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>
