<script setup lang="ts">
import { nextTick, onMounted, reactive, ref } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import {
  createProduct,
  listCategories,
  listProducts,
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

interface ProductForm {
  name: string
  categoryId: string
  priceYuan: string
  unit: string
  coverImageUrl: string
  description: string
  onShelf: boolean
}

const products = ref<Product[]>([])
const categories = ref<Category[]>([])
const dialogVisible = ref(false)
const pending = ref(false)
const imageUploading = ref(false)
const editingId = ref<number>()
const errorMessage = ref('')
const productFormRef = ref<FormInstance>()
const form = reactive<ProductForm>({
  name: '',
  categoryId: '',
  priceYuan: '',
  unit: '',
  coverImageUrl: '',
  description: '',
  onShelf: true,
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
}

const load = async (): Promise<void> => {
  try {
    const [categoryItems, productPage] = await Promise.all([
      listCategories(),
      listProducts({ page: 0, size: 100 }),
    ])
    categories.value = categoryItems
    products.value = productPage.items
  } catch (error) {
    reportUnexpectedError(error, '商品加载失败')
  }
}

const openEditor = (product?: Product): void => {
  editingId.value = product?.id
  Object.assign(form, {
    name: product?.name ?? '',
    categoryId: product ? String(product.categoryId) : '',
    priceYuan: product ? centToYuan(product.priceCent) : '',
    unit: product?.unit ?? '',
    coverImageUrl: product?.coverImageUrl ?? '',
    description: product?.description ?? '',
    onShelf: product?.onShelf ?? true,
  })
  errorMessage.value = ''
  dialogVisible.value = true
  void nextTick(() => productFormRef.value?.clearValidate())
}

const toPayload = (): ProductWriteRequest => {
  if (!form.name.trim()) throw new Error('请输入商品名称')
  if (!form.categoryId) throw new Error('请选择商品分类')
  if (!form.unit.trim()) throw new Error('请输入商品单位')
  return {
    name: form.name.trim(),
    categoryId: Number(form.categoryId),
    priceCent: yuanToCent(form.priceYuan),
    unit: form.unit.trim(),
    coverImageUrl: form.coverImageUrl.trim(),
    description: form.description.trim(),
    onShelf: form.onShelf,
  }
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
  try {
    await setProductShelf(product.id, !product.onShelf)
    await load()
  } catch (error) {
    reportUnexpectedError(error, '商品状态更新失败')
  }
}

onMounted(load)
</script>

<template>
  <section class="page-stack">
    <header class="page-header">
      <div>
        <h1>商品管理</h1>
        <p>价格按人民币分提交，商品规格作为独立商品维护。</p>
      </div>
      <el-button data-test="product-create" type="primary" @click="openEditor()">
        新增商品
      </el-button>
    </header>
    <div class="surface-card">
      <el-table :data="products">
        <el-table-column prop="name" label="商品" min-width="180" />
        <el-table-column prop="categoryName" label="分类" min-width="120" />
        <el-table-column label="价格" width="120">
          <template #default="{ row }">¥{{ centToYuan(row.priceCent) }}/{{ row.unit }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.onShelf ? 'success' : 'info'">
              {{ row.onShelf ? '已上架' : '已下架' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEditor(row)">编辑</el-button>
            <el-button link :type="row.onShelf ? 'danger' : 'success'" @click="toggleShelf(row)">
              {{ row.onShelf ? '下架' : '上架' }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑商品' : '新增商品'" width="600">
      <el-form
        ref="productFormRef"
        :model="form"
        :rules="rules"
        label-position="top"
        class="form-grid"
      >
        <el-form-item label="商品名称" prop="name">
          <input v-model="form.name" data-test="product-name" class="text-control" />
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
        <p v-if="errorMessage" class="error-text">{{ errorMessage }}</p>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
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
