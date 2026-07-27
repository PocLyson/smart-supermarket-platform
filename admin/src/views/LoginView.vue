<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { login } from '@/api/auth'
import { ApiError } from '@/api/http'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()
const form = reactive({ username: '', password: '' })
const errors = reactive({ username: '', password: '' })
const serverError = ref('')
const pending = ref(false)

const submit = async (): Promise<void> => {
  errors.username = form.username.trim() ? '' : '请输入用户名'
  errors.password = form.password ? '' : '请输入密码'
  if (errors.username || errors.password) return
  pending.value = true
  serverError.value = ''
  try {
    auth.setSession(await login({ username: form.username.trim(), password: form.password }))
    await router.replace(auth.isOwner ? '/products' : '/orders')
  } catch (error) {
    serverError.value = error instanceof ApiError ? error.message : '登录失败，请稍后重试'
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <main class="login-page">
    <section class="login-card" aria-labelledby="login-title">
      <p class="eyebrow">STORE OPERATIONS</p>
      <h1 id="login-title">智慧超市管理后台</h1>
      <p class="subtitle">老板与收银员使用各自账号登录</p>
      <form class="form-grid" @submit.prevent="submit">
        <div class="form-field">
          <label for="username">用户名</label>
          <input
            id="username"
            v-model="form.username"
            data-test="login-username"
            class="text-control"
            autocomplete="username"
          />
          <p v-if="errors.username" class="error-text">{{ errors.username }}</p>
        </div>
        <div class="form-field">
          <label for="password">密码</label>
          <input
            id="password"
            v-model="form.password"
            data-test="login-password"
            class="text-control"
            type="password"
            autocomplete="current-password"
          />
          <p v-if="errors.password" class="error-text">{{ errors.password }}</p>
        </div>
        <p v-if="serverError" class="error-text">{{ serverError }}</p>
        <el-button data-test="login-submit" type="primary" native-type="submit" :loading="pending">
          登录
        </el-button>
      </form>
    </section>
  </main>
</template>

<style scoped>
.login-page {
  display: grid;
  min-height: 100vh;
  padding: var(--space-6);
  place-items: center;
}

.login-card {
  width: min(100%, 420px);
  padding: var(--space-8);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-bg-surface);
  box-shadow: var(--shadow-surface);
}

.eyebrow {
  margin: 0 0 var(--space-2);
  color: var(--color-brand);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
}

h1 {
  margin: 0;
}

.subtitle {
  margin: var(--space-2) 0 var(--space-6);
  color: var(--color-text-secondary);
}
</style>
