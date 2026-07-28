<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  createCashier,
  listStaff,
  resetStaffPassword,
  setStaffEnabled,
  type StaffAccount,
} from '@/api/staff'
import { reportUnexpectedError } from '@/utils/errors'
import { formatDateTime } from '@/utils/date'
import UiStatePanel from '@/components/UiStatePanel.vue'
import AppIcon from '@/components/AppIcon.vue'

const items = ref<StaffAccount[]>([])
const dialogVisible = ref(false)
const pending = ref(false)
const errorMessage = ref('')
const form = reactive({ username: '', password: '' })
const loading = ref(false)
const loadError = ref('')
const keyword = ref('')
const statusFilter = ref('')
const showPassword = ref(false)
const filteredItems = computed(() =>
  items.value.filter((item) => {
    const matchesKeyword =
      !keyword.value.trim() ||
      item.username.toLowerCase().includes(keyword.value.trim().toLowerCase())
    const matchesStatus = !statusFilter.value || item.enabled === (statusFilter.value === 'enabled')
    return matchesKeyword && matchesStatus
  }),
)

const clearFilters = (): void => {
  keyword.value = ''
  statusFilter.value = ''
}

const handleEmptyAction = (): void => {
  if (keyword.value || statusFilter.value) clearFilters()
  else openCreate()
}

const load = async (): Promise<void> => {
  loading.value = true
  loadError.value = ''
  try {
    items.value = await listStaff()
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '员工账号加载失败'
    reportUnexpectedError(error, '员工账号加载失败')
  } finally {
    loading.value = false
  }
}

const openCreate = (): void => {
  form.username = ''
  form.password = ''
  errorMessage.value = ''
  showPassword.value = false
  dialogVisible.value = true
}

const submit = async (): Promise<void> => {
  if (!form.username.trim() || !form.password) {
    errorMessage.value = '请输入用户名和初始密码'
    return
  }
  pending.value = true
  try {
    await createCashier({ username: form.username.trim(), password: form.password })
    dialogVisible.value = false
    await load()
    ElMessage.success('收银员账号已创建')
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '创建失败'
  } finally {
    pending.value = false
  }
}

const toggleEnabled = async (staff: StaffAccount): Promise<void> => {
  try {
    await ElMessageBox.confirm(
      `确认${staff.enabled ? '停用' : '启用'}账号 ${staff.username}？`,
      '账号状态变更',
    )
    await setStaffEnabled(staff.id, !staff.enabled)
    await load()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') reportUnexpectedError(error, '账号状态更新失败')
  }
}

const resetPassword = async (staff: StaffAccount): Promise<void> => {
  try {
    const result = await ElMessageBox.prompt(`为 ${staff.username} 设置新密码`, '重置密码', {
      inputType: 'password',
      inputValidator: (value) => (value && value.length >= 8 ? true : '密码至少 8 位'),
    })
    await resetStaffPassword(staff.id, { password: result.value })
    ElMessage.success('密码已重置')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') reportUnexpectedError(error, '密码重置失败')
  }
}

onMounted(load)
</script>

<template>
  <section class="page-stack">
    <header class="page-header">
      <div>
        <p class="page-kicker">人员与权限</p>
        <h1>员工账号</h1>
        <p>仅老板可创建、启停或重置收银员账号。</p>
      </div>
      <el-button data-test="staff-create" type="primary" @click="openCreate">
        <AppIcon name="plus" />新增收银员
      </el-button>
    </header>
    <form class="surface-card filter-panel" @submit.prevent>
      <div class="filter-field is-wide">
        <label for="staff-keyword">账号用户名</label>
        <input id="staff-keyword" v-model="keyword" class="text-control" placeholder="输入用户名" />
      </div>
      <div class="filter-field">
        <label for="staff-status">账号状态</label>
        <select id="staff-status" v-model="statusFilter" class="text-control">
          <option value="">全部状态</option>
          <option value="enabled">启用</option>
          <option value="disabled">停用</option>
        </select>
      </div>
      <div class="filter-actions">
        <el-button native-type="button" :disabled="!keyword && !statusFilter" @click="clearFilters">
          重置
        </el-button>
      </div>
    </form>
    <div class="surface-card data-region">
      <div class="data-region__summary">
        <span>共 {{ filteredItems.length }} 个员工账号</span><span>老板账号不可在此停用</span>
      </div>
      <div v-if="loading" class="skeleton-stack">
        <div v-for="i in 6" :key="i" class="skeleton-row" />
      </div>
      <UiStatePanel
        v-else-if="loadError"
        kind="error"
        title="员工账号加载失败"
        :description="loadError"
        action-label="重新加载"
        @action="load"
      />
      <UiStatePanel
        v-else-if="!filteredItems.length"
        kind="empty"
        :title="keyword || statusFilter ? '没有匹配的员工账号' : '还没有收银员账号'"
        description="创建收银员账号后，员工可登录处理订单。"
        :action-label="keyword || statusFilter ? '清除筛选' : '新增收银员'"
        @action="handleEmptyAction"
      />
      <div v-else class="responsive-table has-mobile-cards">
        <el-table :data="filteredItems">
          <el-table-column prop="username" label="用户名" />
          <el-table-column label="角色" width="120">
            <template #default="{ row }">{{ row.role === 'OWNER' ? '老板' : '收银员' }}</template>
          </el-table-column>
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="row.enabled ? 'success' : 'info'">
                {{ row.enabled ? '启用' : '停用' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="最近登录" min-width="180">
            <template #default="{ row }">{{ formatDateTime(row.lastLoginAt) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="220">
            <template #default="{ row }">
              <template v-if="row.role === 'CASHIER'">
                <el-button
                  :data-test="`staff-toggle-${row.id}`"
                  link
                  type="primary"
                  @click="toggleEnabled(row)"
                >
                  {{ row.enabled ? '停用' : '启用' }}
                </el-button>
                <el-button
                  :data-test="`staff-reset-${row.id}`"
                  link
                  type="primary"
                  @click="resetPassword(row)"
                >
                  重置密码
                </el-button>
              </template>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <div
        v-if="!loading && !loadError && filteredItems.length"
        class="mobile-card-list"
        data-test="staff-mobile-list"
      >
        <article v-for="staff in filteredItems" :key="staff.id" class="mobile-data-card">
          <div class="mobile-data-card__header">
            <strong>{{ staff.username }}</strong>
            <el-tag :type="staff.enabled ? 'success' : 'info'">
              {{ staff.enabled ? '启用' : '停用' }}
            </el-tag>
          </div>
          <div class="mobile-data-card__row">
            <span>{{ staff.role === 'OWNER' ? '老板' : '收银员' }}</span>
            <span class="mobile-data-card__meta">{{ formatDateTime(staff.lastLoginAt) }}</span>
          </div>
          <div v-if="staff.role === 'CASHIER'" class="mobile-data-card__footer">
            <el-button @click="toggleEnabled(staff)">
              <span>{{ staff.enabled ? '停用' : '启用' }}</span>
            </el-button>
            <el-button type="primary" @click="resetPassword(staff)">重置密码</el-button>
          </div>
        </article>
      </div>
    </div>
    <el-dialog v-model="dialogVisible" :teleported="false" title="新增收银员" width="480">
      <div class="form-grid">
        <div class="form-field">
          <label for="staff-username">用户名</label>
          <input
            id="staff-username"
            v-model="form.username"
            data-test="staff-username"
            class="text-control"
            autocomplete="off"
            :disabled="pending"
          />
          <p class="helper-text">建议使用姓名拼音或工号，创建后不可修改。</p>
        </div>
        <div class="form-field">
          <label for="staff-password">初始密码</label>
          <div class="password-control">
            <input
              id="staff-password"
              v-model="form.password"
              data-test="staff-password"
              class="text-control"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="new-password"
              :disabled="pending"
            /><button
              type="button"
              :aria-label="showPassword ? '隐藏密码' : '显示密码'"
              @click="showPassword = !showPassword"
            >
              {{ showPassword ? '隐藏' : '显示' }}
            </button>
          </div>
          <p class="helper-text">至少 8 位，建议同时包含字母和数字；请通过安全方式告知员工。</p>
        </div>
        <p v-if="errorMessage" class="inline-alert" role="alert">{{ errorMessage }}</p>
      </div>
      <template #footer>
        <el-button :disabled="pending" @click="dialogVisible = false">取消</el-button>
        <el-button
          data-test="staff-submit"
          type="primary"
          :loading="pending"
          :disabled="pending"
          @click="submit"
        >
          创建账号
        </el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.password-control {
  position: relative;
}
.password-control .text-control {
  padding-right: 64px;
}
.password-control button {
  position: absolute;
  inset: 0 4px 0 auto;
  min-width: 52px;
  border: 0;
  color: var(--primary-700);
  background: transparent;
  font-weight: 600;
  cursor: pointer;
}
</style>
