<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  createAnnouncement,
  deleteAnnouncement,
  listAnnouncements,
  offlineAnnouncement,
  publishAnnouncement,
  updateAnnouncement,
  type Announcement,
  type AnnouncementStatus,
} from '@/api/announcements'
import AppIcon from '@/components/AppIcon.vue'
import UiStatePanel from '@/components/UiStatePanel.vue'
import { formatDateTime } from '@/utils/date'
import { reportUnexpectedError } from '@/utils/errors'

const pageSize = 20
const items = ref<Announcement[]>([])
const total = ref(0)
const loading = ref(false)
const loadError = ref('')
const status = ref<AnnouncementStatus | ''>('')
const dialogVisible = ref(false)
const pending = ref(false)
const editingId = ref<number | null>(null)
const form = reactive({ title: '', content: '' })
const formError = ref('')

const titleCount = computed(() => form.title.length)
const contentCount = computed(() => form.content.length)
const formInvalid = computed(
  () =>
    !form.title.trim() ||
    !form.content.trim() ||
    titleCount.value > 60 ||
    contentCount.value > 2000,
)
const dialogTitle = computed(() => (editingId.value === null ? '新建公告' : '编辑公告'))

const load = async (): Promise<void> => {
  loading.value = true
  loadError.value = ''
  try {
    const result = await listAnnouncements({
      ...(status.value ? { status: status.value } : {}),
      page: 0,
      size: pageSize,
    })
    items.value = result.items
    total.value = result.total
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '公告加载失败'
    reportUnexpectedError(error, '公告加载失败')
  } finally {
    loading.value = false
  }
}

const openCreate = (): void => {
  editingId.value = null
  form.title = ''
  form.content = ''
  formError.value = ''
  dialogVisible.value = true
}

const openEdit = (announcement: Announcement): void => {
  editingId.value = announcement.id
  form.title = announcement.title
  form.content = announcement.content
  formError.value = ''
  dialogVisible.value = true
}

const submit = async (): Promise<void> => {
  if (formInvalid.value) {
    formError.value = '请填写标题和正文，并确保不超过长度限制。'
    return
  }
  pending.value = true
  formError.value = ''
  const payload = { title: form.title.trim(), content: form.content.trim() }
  try {
    if (editingId.value === null) {
      await createAnnouncement(payload)
      ElMessage.success('公告草稿已创建')
    } else {
      await updateAnnouncement(editingId.value, payload)
      ElMessage.success('公告已更新')
    }
    dialogVisible.value = false
    await load()
  } catch (error) {
    formError.value = error instanceof Error ? error.message : '公告保存失败'
  } finally {
    pending.value = false
  }
}

type LifecycleAction = 'publish' | 'offline' | 'delete'

const actionCopy: Record<
  LifecycleAction,
  { message: string; title: string; confirmButtonText: string }
> = {
  publish: {
    message: '发布后，顾客将在小程序中看到此公告。确认发布吗？',
    title: '发布公告',
    confirmButtonText: '确认发布',
  },
  offline: {
    message: '下线后，顾客将无法继续查看此公告。确认下线吗？',
    title: '下线公告',
    confirmButtonText: '确认下线',
  },
  delete: {
    message: '删除后无法恢复。确认删除这条公告吗？',
    title: '删除公告',
    confirmButtonText: '确认删除',
  },
}

const runLifecycleAction = async (
  announcement: Announcement,
  action: LifecycleAction,
): Promise<void> => {
  const { message, title, confirmButtonText } = actionCopy[action]
  try {
    await ElMessageBox.confirm(message, title, {
      confirmButtonText,
      cancelButtonText: '取消',
      type: action === 'delete' ? 'warning' : 'info',
    })
    if (action === 'publish') await publishAnnouncement(announcement.id)
    if (action === 'offline') await offlineAnnouncement(announcement.id)
    if (action === 'delete') await deleteAnnouncement(announcement.id)
    ElMessage.success(
      action === 'publish' ? '公告已发布' : action === 'offline' ? '公告已下线' : '公告已删除',
    )
    await load()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      reportUnexpectedError(error, '公告操作失败')
    }
  }
}

const statusLabel: Record<AnnouncementStatus, string> = {
  DRAFT: '草稿',
  PUBLISHED: '已发布',
  OFFLINE: '已下线',
}

const statusTagType = (value: AnnouncementStatus): 'info' | 'success' | 'warning' =>
  value === 'PUBLISHED' ? 'success' : value === 'OFFLINE' ? 'info' : 'warning'

const statusLabelFor = (value: AnnouncementStatus): string => statusLabel[value]

onMounted(load)
</script>

<template>
  <section class="page-stack">
    <header class="page-header">
      <div>
        <p class="page-kicker">门店沟通</p>
        <h1>公告管理</h1>
        <p>创建、发布和下线面向顾客的小程序公告。</p>
      </div>
      <el-button data-test="announcement-create" type="primary" @click="openCreate">
        <AppIcon name="plus" />新建公告
      </el-button>
    </header>

    <form class="surface-card filter-panel" @submit.prevent>
      <div class="filter-field">
        <label for="announcement-status">公告状态</label>
        <select
          id="announcement-status"
          v-model="status"
          data-test="announcement-status"
          class="text-control"
          @change="load"
        >
          <option value="">全部状态</option>
          <option value="DRAFT">草稿</option>
          <option value="PUBLISHED">已发布</option>
          <option value="OFFLINE">已下线</option>
        </select>
      </div>
      <div class="filter-actions">
        <el-button :loading="loading" @click="load"><AppIcon name="refresh" />刷新</el-button>
      </div>
    </form>

    <div class="surface-card data-region">
      <div class="data-region__summary">
        <span>共 {{ total }} 条公告</span><span>每页展示 {{ pageSize }} 条</span>
      </div>
      <div v-if="loading" class="skeleton-stack">
        <div v-for="i in 4" :key="i" class="skeleton-row" />
      </div>
      <UiStatePanel
        v-else-if="loadError"
        kind="error"
        title="公告加载失败"
        :description="loadError"
        action-label="重新加载"
        @action="load"
      />
      <UiStatePanel
        v-else-if="!items.length"
        kind="empty"
        :title="status ? '没有匹配状态的公告' : '还没有公告'"
        description="新建公告后，可以在这里发布给顾客。"
        :action-label="status ? '刷新列表' : '新建公告'"
        @action="status ? load() : openCreate()"
      />
      <template v-else>
        <div class="responsive-table has-mobile-cards">
          <el-table :data="items">
            <el-table-column prop="title" label="标题" min-width="180" />
            <el-table-column label="状态" width="110">
              <template #default="{ row }">
                <el-tag :type="statusTagType(row.status)">{{ statusLabelFor(row.status) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="发布时间" min-width="180">
              <template #default="{ row }">{{ formatDateTime(row.publishedAt) }}</template>
            </el-table-column>
            <el-table-column label="更新时间" min-width="180">
              <template #default="{ row }">{{ formatDateTime(row.updatedAt) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="250" fixed="right">
              <template #default="{ row }">
                <template v-if="row.status !== 'PUBLISHED'">
                  <el-button
                    :data-test="`announcement-edit-${row.id}`"
                    link
                    type="primary"
                    @click="openEdit(row)"
                    >编辑</el-button
                  >
                  <el-button
                    :data-test="`announcement-delete-${row.id}`"
                    link
                    type="danger"
                    @click="runLifecycleAction(row, 'delete')"
                    >删除</el-button
                  >
                  <el-button
                    :data-test="`announcement-publish-${row.id}`"
                    link
                    type="primary"
                    @click="runLifecycleAction(row, 'publish')"
                    >{{ row.status === 'OFFLINE' ? '重新发布' : '发布' }}</el-button
                  >
                </template>
                <el-button
                  v-else
                  :data-test="`announcement-offline-${row.id}`"
                  link
                  type="warning"
                  @click="runLifecycleAction(row, 'offline')"
                  >下线</el-button
                >
              </template>
            </el-table-column>
          </el-table>
        </div>
        <div class="mobile-card-list" data-test="announcement-mobile-list">
          <article v-for="announcement in items" :key="announcement.id" class="mobile-data-card">
            <div class="mobile-data-card__header">
              <strong>{{ announcement.title }}</strong>
              <el-tag :type="statusTagType(announcement.status)">{{
                statusLabel[announcement.status]
              }}</el-tag>
            </div>
            <p class="announcement-content">{{ announcement.content }}</p>
            <div class="mobile-data-card__row">
              <span class="mobile-data-card__meta">{{
                formatDateTime(announcement.updatedAt)
              }}</span>
              <span v-if="announcement.publishedAt" class="mobile-data-card__meta"
                >发布 {{ formatDateTime(announcement.publishedAt) }}</span
              >
            </div>
            <div class="mobile-data-card__footer">
              <template v-if="announcement.status !== 'PUBLISHED'">
                <el-button @click="openEdit(announcement)">编辑</el-button>
                <el-button type="danger" plain @click="runLifecycleAction(announcement, 'delete')"
                  >删除</el-button
                >
                <el-button type="primary" @click="runLifecycleAction(announcement, 'publish')">{{
                  announcement.status === 'OFFLINE' ? '重新发布' : '发布'
                }}</el-button>
              </template>
              <el-button v-else type="warning" @click="runLifecycleAction(announcement, 'offline')"
                >下线</el-button
              >
            </div>
          </article>
        </div>
      </template>
    </div>

    <el-dialog
      v-model="dialogVisible"
      :teleported="false"
      :title="dialogTitle"
      width="min(560px, calc(100vw - 32px))"
    >
      <div class="form-grid">
        <div class="form-field">
          <label for="announcement-title">标题</label>
          <input
            id="announcement-title"
            v-model="form.title"
            data-test="announcement-title"
            class="text-control"
            :disabled="pending"
          />
          <p
            :class="['helper-text', { 'is-over-limit': titleCount > 60 }]"
            data-test="announcement-title-count"
          >
            {{ titleCount }}/60
          </p>
        </div>
        <div class="form-field">
          <label for="announcement-content">正文</label>
          <textarea
            id="announcement-content"
            v-model="form.content"
            data-test="announcement-content"
            class="text-control announcement-textarea"
            rows="8"
            :disabled="pending"
          />
          <p
            :class="['helper-text', { 'is-over-limit': contentCount > 2000 }]"
            data-test="announcement-content-count"
          >
            {{ contentCount }}/2000
          </p>
        </div>
        <p v-if="formError" class="inline-alert" role="alert">{{ formError }}</p>
      </div>
      <template #footer>
        <el-button :disabled="pending" @click="dialogVisible = false">取消</el-button>
        <el-button
          data-test="announcement-submit"
          type="primary"
          :loading="pending"
          :disabled="pending || formInvalid"
          @click="submit"
          >保存草稿</el-button
        >
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.announcement-content {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  color: var(--color-text-secondary);
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}
.announcement-textarea {
  min-height: 160px;
  resize: vertical;
}
.is-over-limit {
  color: var(--el-color-danger);
  font-weight: 600;
}
</style>
