<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage, type UploadRawFile, type UploadRequestOptions } from 'element-plus'
import { uploadProductImage } from '@/api/images'

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{
  'update:modelValue': [value: string]
  'uploading-change': [value: boolean]
  error: [message: string]
}>()
const uploading = ref(false)
const errorMessage = ref('')

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const maxSize = 5 * 1024 * 1024

const previewUrl = computed(() => {
  if (!props.modelValue) return ''
  if (/^https?:\/\//.test(props.modelValue)) return props.modelValue
  const base = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')
  return `${base}${props.modelValue}`
})

const beforeUpload = (file: UploadRawFile): boolean => {
  if (!allowedTypes.has(file.type)) {
    ElMessage.error('仅支持 JPEG、PNG 或 WebP 图片')
    return false
  }
  if (file.size > maxSize) {
    ElMessage.error('图片大小不能超过 5 MiB')
    return false
  }
  return true
}

const upload = async (options: UploadRequestOptions): Promise<void> => {
  uploading.value = true
  errorMessage.value = ''
  emit('uploading-change', true)
  try {
    const response = await uploadProductImage(options.file)
    emit('update:modelValue', response.url)
    options.onSuccess(response)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '图片上传失败'
    emit('error', errorMessage.value)
    options.onError(error as never)
  } finally {
    uploading.value = false
    emit('uploading-change', false)
  }
}
</script>

<template>
  <div class="image-upload">
    <div v-if="previewUrl" class="preview">
      <img :src="previewUrl" alt="商品封面预览" />
    </div>
    <el-upload
      action=""
      accept="image/jpeg,image/png,image/webp"
      :show-file-list="false"
      :before-upload="beforeUpload"
      :http-request="upload"
      :disabled="uploading"
    >
      <el-button :loading="uploading">{{ modelValue ? '更换图片' : '上传图片' }}</el-button>
    </el-upload>
    <p class="hint">支持 JPEG、PNG、WebP，最大 5 MiB</p>
    <p v-if="errorMessage" class="error-text">{{ errorMessage }}</p>
  </div>
</template>

<style scoped>
.image-upload {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
}

.preview {
  width: 88px;
  aspect-ratio: 1;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-canvas);
}

.preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.hint {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 13px;
}
</style>
