<script setup lang="ts">
import { nextTick, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import {
  archiveProduct,
  createProduct,
  listCategories,
  listProducts,
  restoreProduct,
  setProductShelf,
  updateProduct,
  type Category,
  type Product,
  type ProductWriteRequest,
} from '@/api/catalog'
import { ApiError } from '@/api/http'
import ProductImageUpload from '@/components/ProductImageUpload.vue'
import { reportUnexpectedError } from '@/utils/errors'
import { centToYuan, yuanToCent } from '@/utils/money'
import UiStatePanel from '@/components/UiStatePanel.vue'
import AppIcon from '@/components/AppIcon.vue'

interface ProductForm {
  name: string
  categoryId: string
  priceYuan: string
  unit: string
  coverImageUrl: string
  description: string
  onShelf: boolean
  initialStock: string
}

const products = ref<Product[]>([])
const categories = ref<Category[]>([])
const dialogVisible = ref(false)
const pending = ref(false)
const actionPendingIds = ref<Set<number>>(new Set())
const imageUploading = ref(false)
const editingId = ref<number>()
const errorMessage = ref('')
const loading = ref(false)
const loadError = ref('')
const total = ref(0)
const page = ref(1)
const pageSize = 20
const filters = reactive({
  keyword: '',
  categoryId: '',
  shelf: '',
  archiveStatus: 'ACTIVE' as 'ACTIVE' | 'ARCHIVED' | 'ALL',
})
const productFormRef = ref<FormInstance>()
const brokenImageIds = ref<Set<number>>(new Set())
const form = reactive<ProductForm>({
  name: '',
  categoryId: '',
  priceYuan: '',
  unit: '',
  coverImageUrl: '',
  description: '',
  onShelf: true,
  initialStock: '0',
})
const rules: FormRules<ProductForm> = {
  name: [{ required: true, message: '请输入商品名称', trigger: 'blur' }],
  categoryId: [{ required: true, message: '请选择商品分类', trigger: 'change' }],
  priceYuan: [
    {
      validator: (_rule, value: string, callback) => {
        try {
          yuanToCent(value)
          callback()
        } catch {
          callback(new Error('金额格式错误'))
        }
      },
      trigger: 'blur',
    },
  ],
  unit: [{ required: true, message: '请输入商品单位', trigger: 'blur' }],
  initialStock: [
    {
      validator: (_rule, value: string, callback) => {
        const stock = Number(value)
        if (!Number.isInteger(stock) || stock < 0) {
          callback(new Error('初始库存必须是大于等于0的整数'))
          return
        }
        callback()
      },
      trigger: 'blur',
    },
  ],
}

const load = async (): Promise<void> => {
  loading.value = true
  loadError.value = ''
  try {
    const [categoryItems, productPage] = await Promise.all([
      listCategories(),
      listProducts({
        keyword: filters.keyword.trim() || undefined,
        categoryId: filters.categoryId ? Number(filters.categoryId) : undefined,
        archiveStatus: filters.archiveStatus,
        page: page.value - 1,
        size: pageSize,
      }),
    ])
    categories.value = categoryItems
    products.value =
      filters.shelf === ''
        ? productPage.items
        : productPage.items.filter((item) => item.onShelf === (filters.shelf === 'on'))
    total.value = filters.shelf === '' ? productPage.total : products.value.length
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '商品加载失败'
    reportUnexpectedError(error, '商品加载失败')
  } finally {
    loading.value = false
  }
}

const search = async (): Promise<void> => {
  page.value = 1
  await load()
}
const reset = async (): Promise<void> => {
  Object.assign(filters, { keyword: '', categoryId: '', shelf: '', archiveStatus: 'ACTIVE' })
  page.value = 1
  await load()
}
const changePage = async (value: number): Promise<void> => {
  page.value = value
  await load()
}

const markImageBroken = (productId: number): void => {
  brokenImageIds.value = new Set(brokenImageIds.value).add(productId)
}

const isActionPending = (productId: number): boolean => actionPendingIds.value.has(productId)

const setActionPending = (productId: number, value: boolean): void => {
  const next = new Set(actionPendingIds.value)
  if (value) next.add(productId)
  else next.delete(productId)
  actionPendingIds.value = next
}

const openEditor = (product?: Product): void => {
  if (imageUploading.value) {
    errorMessage.value = '图片上传完成后才能切换商品'
    return
  }
  editingId.value = product?.id
  Object.assign(form, {
    name: product?.name ?? '',
    categoryId: product ? String(product.categoryId) : '',
    priceYuan: product ? centToYuan(product.priceCent) : '',
    unit: product?.unit ?? '',
    coverImageUrl: product?.coverImageUrl ?? '',
    description: product?.description ?? '',
    onShelf: product?.onShelf ?? true,
    initialStock: '0',
  })
  errorMessage.value = ''
  dialogVisible.value = true
  void nextTick(() => productFormRef.value?.clearValidate())
}

const requestClose = (): void => {
  if (imageUploading.value) {
    errorMessage.value = '图片上传完成后才能关闭编辑器'
    return
  }
  dialogVisible.value = false
}

const beforeClose = (done: () => void): void => {
  if (imageUploading.value) {
    errorMessage.value = '图片上传完成后才能关闭编辑器'
    return
  }
  done()
}

const toPayload = (): ProductWriteRequest => {
  if (!form.name.trim()) throw new Error('请输入商品名称')
  if (!form.categoryId) throw new Error('请选择商品分类')
  if (!form.unit.trim()) throw new Error('请输入商品单位')
  const payload: ProductWriteRequest = {
    name: form.name.trim(),
    categoryId: Number(form.categoryId),
    priceCent: yuanToCent(form.priceYuan),
    unit: form.unit.trim(),
    coverImageUrl: form.coverImageUrl.trim(),
    description: form.description.trim(),
    onShelf: form.onShelf,
  }
  if (!editingId.value) payload.initialStock = Number(form.initialStock)
  return payload
}

const submit = async (): Promise<void> => {
  if (imageUploading.value) {
    errorMessage.value = '图片上传完成后才能保存商品'
    return
  }
  try {
    await productFormRef.value?.validate()
  } catch {
    return
  }
  pending.value = true
  errorMessage.value = ''
  try {
    const payload = toPayload()
    if (editingId.value) await updateProduct(editingId.value, payload)
    else await createProduct(payload)
    dialogVisible.value = false
    await load()
    ElMessage.success('商品已保存')
  } catch (error) {
    errorMessage.value =
      error instanceof ApiError || error instanceof Error ? error.message : '保存失败'
  } finally {
    pending.value = false
  }
}

const toggleShelf = async (product: Product): Promise<void> => {
  if (isActionPending(product.id)) return
  setActionPending(product.id, true)
  try {
    await ElMessageBox.confirm(
      `确认${product.onShelf ? '下架' : '上架'}“${product.name}”？${product.onShelf ? '下架后顾客将无法购买。' : '上架后顾客可在小程序中购买。'}`,
      product.onShelf ? '确认下架商品' : '确认上架商品',
      {
        confirmButtonText: product.onShelf ? '确认下架' : '确认上架',
        cancelButtonText: '取消',
        type: product.onShelf ? 'warning' : 'info',
      },
    )
    await setProductShelf(product.id, !product.onShelf)
    await load()
    ElMessage.success(product.onShelf ? '商品已下架' : '商品已上架')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') reportUnexpectedError(error, '商品状态更新失败')
  } finally {
    setActionPending(product.id, false)
  }
}

const archive = async (product: Product): Promise<void> => {
  if (isActionPending(product.id)) return
  setActionPending(product.id, true)
  try {
    await ElMessageBox.confirm(
      '删除后商品将立即下架，顾客无法继续购买；历史订单不会受影响。',
      '确认删除商品',
      {
        confirmButtonText: '确认删除',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )
    await archiveProduct(product.id)
    await load()
    ElMessage.success('商品已删除')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') reportUnexpectedError(error, '商品删除失败')
  } finally {
    setActionPending(product.id, false)
  }
}

const restore = async (product: Product): Promise<void> => {
  if (isActionPending(product.id)) return
  setActionPending(product.id, true)
  try {
    await restoreProduct(product.id)
    await load()
    ElMessage.success('商品已恢复，请检查库存、价格和图片后手动上架')
  } catch (error) {
    reportUnexpectedError(error, '商品恢复失败')
  } finally {
    setActionPending(product.id, false)
  }
}

onMounted(load)
</script>

<template>
  <section class="page-stack">
    <header class="page-header">
      <div>
        <p class="page-kicker">商品与售卖</p>
        <h1>商品管理</h1>
        <p>维护小程序商品信息、售价和上下架状态。</p>
      </div>
      <el-button
        data-test="product-create"
        type="primary"
        :disabled="imageUploading"
        @click="openEditor()"
      >
        <AppIcon name="plus" />新增商品
      </el-button>
    </header>
    <form class="surface-card filter-panel" @submit.prevent="search">
      <div class="filter-field is-wide">
        <label for="product-keyword">商品关键词</label>
        <input
          id="product-keyword"
          v-model="filters.keyword"
          class="text-control"
          placeholder="商品名称"
        />
      </div>
      <div class="filter-field">
        <label for="product-category-filter">商品分类</label>
        <select id="product-category-filter" v-model="filters.categoryId" class="text-control">
          <option value="">全部分类</option>
          <option v-for="category in categories" :key="category.id" :value="String(category.id)">
            {{ category.name }}
          </option>
        </select>
      </div>
      <div class="filter-field">
        <label for="product-shelf-filter">售卖状态</label>
        <select id="product-shelf-filter" v-model="filters.shelf" class="text-control">
          <option value="">全部状态</option>
          <option value="on">已上架</option>
          <option value="off">已下架</option>
        </select>
      </div>
      <div class="filter-field">
        <label for="product-archive-filter">归档状态</label>
        <select
          id="product-archive-filter"
          v-model="filters.archiveStatus"
          data-test="product-archive-filter"
          class="text-control"
        >
          <option value="ACTIVE">正常商品</option>
          <option value="ARCHIVED">已删除商品</option>
          <option value="ALL">全部商品</option>
        </select>
      </div>
      <div class="filter-actions">
        <el-button native-type="button" @click="reset">重置</el-button>
        <el-button
          data-test="product-search"
          native-type="button"
          type="primary"
          :loading="loading"
          @click="search"
        >
          <AppIcon name="search" />查询
        </el-button>
      </div>
    </form>
    <div class="surface-card data-region">
      <div class="data-region__summary">
        <span>共 {{ total }} 件商品</span><span>价格为顾客最终看到的线上售价</span>
      </div>
      <div v-if="loading" class="skeleton-stack">
        <div v-for="i in 8" :key="i" class="skeleton-row" />
      </div>
      <UiStatePanel
        v-else-if="loadError"
        kind="error"
        title="商品加载失败"
        :description="loadError"
        action-label="重新加载"
        @action="load"
      />
      <UiStatePanel
        v-else-if="!products.length"
        kind="empty"
        :title="
          filters.keyword || filters.categoryId || filters.shelf || filters.archiveStatus !== 'ACTIVE'
            ? '当前筛选没有商品'
            : '还没有商品'
        "
        description="新增商品后可设置图片、分类、售价和上下架状态。"
        :action-label="
          filters.keyword || filters.categoryId || filters.shelf || filters.archiveStatus !== 'ACTIVE'
            ? '清除筛选'
            : '新增商品'
        "
        @action="
          filters.keyword || filters.categoryId || filters.shelf || filters.archiveStatus !== 'ACTIVE'
            ? reset()
            : openEditor()
        "
      />
      <div v-else class="responsive-table has-mobile-cards">
        <el-table :data="products">
          <el-table-column label="商品" min-width="220">
            <template #default="{ row }">
              <div class="product-cell">
                <img
                  v-if="row.coverImageUrl && !brokenImageIds.has(row.id)"
                  :src="row.coverImageUrl"
                  :alt="`${row.name}商品缩略图`"
                  width="44"
                  height="44"
                  :data-test="`product-image-${row.id}`"
                  @error="markImageBroken(row.id)"
                />
                <span
                  v-else
                  class="product-image-fallback"
                  :data-test="`product-image-fallback-${row.id}`"
                  aria-label="商品图片暂不可用"
                >
                  <AppIcon name="products" :size="20" />
                </span>
                <div>
                  <strong>{{ row.name }}</strong
                  ><span>{{ row.unit }}</span>
                </div>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="categoryName" label="分类" min-width="120" />
          <el-table-column label="线上售价" width="130" align="right">
            <template #default="{ row }">¥{{ centToYuan(row.priceCent) }}/{{ row.unit }}</template>
          </el-table-column>
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="row.onShelf ? 'success' : 'info'">
                {{ row.onShelf ? '已上架' : '已下架' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="240">
            <template #default="{ row }">
              <template v-if="row.archived">
                <el-button
                  :data-test="`restore-${row.id}`"
                  link
                  type="primary"
                  :loading="isActionPending(row.id)"
                  :disabled="isActionPending(row.id)"
                  @click="restore(row)"
                >恢复</el-button>
              </template>
              <template v-else>
                <el-button :data-test="`edit-${row.id}`" link type="primary" @click="openEditor(row)">编辑</el-button>
                <el-button
                  :data-test="`shelf-${row.id}`"
                  link
                  :type="row.onShelf ? 'danger' : 'success'"
                  :loading="isActionPending(row.id)"
                  :disabled="isActionPending(row.id)"
                  @click="toggleShelf(row)"
                >{{ row.onShelf ? '下架' : '上架' }}</el-button>
                <el-button
                  :data-test="`archive-${row.id}`"
                  link
                  type="danger"
                  :loading="isActionPending(row.id)"
                  :disabled="isActionPending(row.id)"
                  @click="archive(row)"
                >删除</el-button>
              </template>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <div
        v-if="!loading && !loadError && products.length"
        class="mobile-card-list"
        data-test="product-mobile-list"
      >
        <article v-for="product in products" :key="product.id" class="mobile-data-card">
          <div class="product-mobile-card__main">
            <img
              v-if="product.coverImageUrl && !brokenImageIds.has(product.id)"
              :src="product.coverImageUrl"
              :alt="`${product.name}商品缩略图`"
              width="64"
              height="64"
              @error="markImageBroken(product.id)"
            />
            <span v-else class="product-image-fallback" aria-label="商品图片暂不可用">
              <AppIcon name="products" :size="24" />
            </span>
            <div>
              <div class="mobile-data-card__header">
                <strong>{{ product.name }}</strong>
                <el-tag :type="product.onShelf ? 'success' : 'info'">
                  {{ product.onShelf ? '已上架' : '已下架' }}
                </el-tag>
              </div>
              <span class="mobile-data-card__meta">
                {{ product.categoryName }} · {{ product.unit }}
              </span>
              <div class="product-mobile-card__price">
                <span class="price-text">¥{{ centToYuan(product.priceCent) }}</span>
                <template v-if="product.archived">
                  <el-button
                    :data-test="`restore-mobile-${product.id}`"
                    link
                    type="primary"
                    :loading="isActionPending(product.id)"
                    :disabled="isActionPending(product.id)"
                    @click="restore(product)"
                  >恢复</el-button>
                </template>
                <template v-else>
                  <el-button link type="primary" @click="openEditor(product)">编辑</el-button>
                  <el-button
                    link
                    :type="product.onShelf ? 'danger' : 'success'"
                    :loading="isActionPending(product.id)"
                    :disabled="isActionPending(product.id)"
                    @click="toggleShelf(product)"
                  >{{ product.onShelf ? '下架' : '上架' }}</el-button>
                  <el-button
                    :data-test="`archive-mobile-${product.id}`"
                    link
                    type="danger"
                    :loading="isActionPending(product.id)"
                    :disabled="isActionPending(product.id)"
                    @click="archive(product)"
                  >删除</el-button>
                </template>
              </div>
            </div>
          </div>
        </article>
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
    <el-dialog
      v-model="dialogVisible"
      :title="editingId ? '编辑商品' : '新增商品'"
      width="600"
      style="--dialog-width: 600px"
      :before-close="beforeClose"
      :show-close="!imageUploading"
      :close-on-click-modal="!imageUploading"
      :close-on-press-escape="!imageUploading"
    >
      <el-form
        ref="productFormRef"
        :model="form"
        :rules="rules"
        label-position="top"
        class="form-grid"
      >
        <el-form-item label="商品名称" prop="name">
          <input
            id="product-name"
            v-model="form.name"
            data-test="product-name"
            class="text-control"
          />
        </el-form-item>
        <el-form-item label="商品分类" prop="categoryId">
          <select v-model="form.categoryId" data-test="product-category" class="text-control">
            <option value="" disabled>请选择分类</option>
            <option v-for="category in categories" :key="category.id" :value="String(category.id)">
              {{ category.name }}
            </option>
          </select>
        </el-form-item>
        <el-form-item label="售价（元）" prop="priceYuan">
          <input
            v-model="form.priceYuan"
            data-test="product-price"
            class="text-control"
            inputmode="decimal"
          />
        </el-form-item>
        <el-form-item label="单位" prop="unit">
          <input v-model="form.unit" data-test="product-unit" class="text-control" />
        </el-form-item>
        <el-form-item v-if="!editingId" label="初始库存" prop="initialStock">
          <input
            v-model="form.initialStock"
            data-test="product-initial-stock"
            class="text-control"
            inputmode="numeric"
          />
          <p class="helper-text">新品保存后立即计入可售库存；填写0时顾客端显示暂时缺货。</p>
        </el-form-item>
        <el-form-item label="商品封面">
          <ProductImageUpload
            v-model="form.coverImageUrl"
            @uploading-change="imageUploading = $event"
            @error="errorMessage = $event"
          />
        </el-form-item>
        <el-form-item label="商品详情">
          <textarea v-model="form.description" class="text-control" />
        </el-form-item>
        <el-switch v-model="form.onShelf" active-text="上架" inactive-text="下架" />
        <p v-if="errorMessage" class="inline-alert" role="alert">{{ errorMessage }}</p>
      </el-form>
      <template #footer>
        <el-button data-test="product-cancel" @click="requestClose">取消</el-button>
        <el-button
          data-test="product-submit"
          type="primary"
          :loading="pending"
          :disabled="pending || imageUploading"
          @click="submit"
        >
          保存
        </el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.product-cell {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.product-cell img {
  flex: 0 0 auto;
  border: 1px solid var(--color-divider);
  border-radius: var(--radius-sm);
  object-fit: cover;
}

.product-image-fallback {
  display: grid;
  flex: 0 0 auto;
  width: 44px;
  height: 44px;
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-md);
  color: var(--color-text-tertiary);
  background: var(--color-bg-subtle);
  place-items: center;
}

.product-mobile-card__main {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr);
  gap: var(--space-3);
}

.product-mobile-card__main > img,
.product-mobile-card__main > .product-image-fallback {
  width: 64px;
  height: 64px;
  border-radius: var(--radius-md);
  object-fit: cover;
}

.product-mobile-card__main > div {
  display: grid;
  gap: var(--space-2);
  min-width: 0;
}

.product-mobile-card__price {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}
.product-cell div {
  display: grid;
}
.product-cell span {
  color: var(--color-text-tertiary);
  font-size: var(--font-size-helper);
}
</style>
