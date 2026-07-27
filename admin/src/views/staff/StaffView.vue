<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  createCashier,
  listStaff,
  resetStaffPassword,
  setStaffEnabled,
  type StaffAccount,
} from '@/api/staff'
import { reportUnexpectedError } from '@/utils/errors'

const items = ref<StaffAccount[]>([])
const dialogVisible = ref(false)
const pending = ref(false)
const errorMessage = ref('')
const form = reactive({ username: '', password: '' })

const load = async (): Promise<void> => {
  try {
    items.value = await listStaff()
  } catch (error) {
    reportUnexpectedError(error, '员工账号加载失败')
  }
}

const openCreate = (): void => {
  form.username = ''
  form.password = ''
  errorMessage.value = ''
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
        <h1>员工账号</h1>
        <p>仅老板可创建、启停或重置收银员账号。</p>
      </div>
      <el-button data-test="staff-create" type="primary" @click="openCreate">
        新增收银员
      </el-button>
    </header>
    <div class="surface-card">
      <el-table :data="items">
        <el-table-column prop="username" label="用户名" />
        <el-table-column prop="role" label="角色" width="120" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">{{ row.enabled ? '启用' : '停用' }}</template>
        </el-table-column>
        <el-table-column prop="lastLoginAt" label="最近登录" min-width="180" />
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
    <el-dialog v-model="dialogVisible" :teleported="false" title="新增收银员" width="480">
      <div class="form-grid">
        <div class="form-field">
          <label>用户名</label>
          <input v-model="form.username" data-test="staff-username" class="text-control" />
        </div>
        <div class="form-field">
          <label>初始密码</label>
          <input
            v-model="form.password"
            data-test="staff-password"
            class="text-control"
            type="password"
          />
        </div>
        <p v-if="errorMessage" class="error-text">{{ errorMessage }}</p>
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
