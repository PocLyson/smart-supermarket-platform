<script setup lang="ts">
import { nextTick, reactive, ref } from 'vue'
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
const showPassword = ref(false)
const usernameInput = ref<{ focus: () => void }>()
const passwordInput = ref<{ focus: () => void }>()

const submit = async (): Promise<void> => {
  errors.username = form.username.trim() ? '' : '请输入用户名'
  errors.password = form.password ? '' : '请输入密码'
  if (errors.username || errors.password) {
    await nextTick()
    ;(errors.username ? usernameInput.value : passwordInput.value)?.focus()
    return
  }
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
    <div class="login-brand" aria-hidden="true">
      <span>鲁能超市 · 李老家分店管理后台</span>
      <strong>让门店经营更清楚、更高效</strong>
      <p>订单、商品与线上库存集中管理，服务鲁能超市李老家分店日常运营。</p>
    </div>
    <section class="login-card" aria-labelledby="login-title">
      <div class="brand-sign" aria-hidden="true">鲁</div>
      <p class="eyebrow">鲁能超市李老家分店</p>
      <h1 id="login-title">门店管理后台</h1>
      <p class="subtitle">老板与收银员使用各自账号登录</p>
      <div v-if="serverError" class="inline-alert" role="alert">
        <div>
          <strong>登录未完成</strong>
          <p>{{ serverError }}</p>
        </div>
      </div>
      <form class="form-grid" @submit.prevent="submit">
        <div class="form-field">
          <label for="username">用户名</label>
          <input
            id="username"
            ref="usernameInput"
            v-model="form.username"
            data-test="login-username"
            class="text-control"
            autocomplete="username"
            :disabled="pending"
            aria-describedby="username-error"
          />
          <p v-if="errors.username" id="username-error" class="error-text" role="alert">
            {{ errors.username }}
          </p>
        </div>
        <div class="form-field">
          <label for="password">密码</label>
          <div class="password-control">
            <input
              id="password"
              ref="passwordInput"
              v-model="form.password"
              data-test="login-password"
              class="text-control"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="current-password"
              :disabled="pending"
              aria-describedby="password-error"
            />
            <button
              data-test="password-toggle"
              class="password-toggle"
              type="button"
              :aria-label="showPassword ? '隐藏密码' : '显示密码'"
              :disabled="pending"
              @click="showPassword = !showPassword"
            >
              {{ showPassword ? '隐藏' : '显示' }}
            </button>
          </div>
          <p v-if="errors.password" id="password-error" class="error-text" role="alert">
            {{ errors.password }}
          </p>
        </div>
        <el-button
          data-test="login-submit"
          type="primary"
          native-type="submit"
          :loading="pending"
          :disabled="pending"
        >
          登录
        </el-button>
      </form>
      <p class="login-footnote">仅限门店工作人员使用 · 请勿共享账号与密码</p>
    </section>
  </main>
</template>

<style scoped>
.login-page {
  display: grid;
  grid-template-columns: minmax(420px, 640px) minmax(380px, 464px);
  gap: clamp(48px, 8vw, 120px);
  min-height: 100dvh;
  padding: var(--space-6);
  place-items: center;
  place-content: center;
  background:
    linear-gradient(90deg, var(--primary-900) 0 52%, transparent 52%), var(--color-bg-page);
}

.login-brand {
  color: #fff;
}

.login-brand span {
  display: block;
  margin-bottom: var(--space-6);
  font-size: 18px;
  font-weight: 600;
}

.login-brand strong {
  display: block;
  max-width: 560px;
  font-size: clamp(32px, 4vw, 48px);
  line-height: 1.3;
}

.login-brand p {
  max-width: 540px;
  color: rgb(255 255 255 / 76%);
  font-size: 15px;
}

.login-card {
  width: min(100%, 440px);
  padding: var(--space-10);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-bg-surface);
  box-shadow: var(--shadow-dropdown);
}

.brand-sign {
  display: grid;
  width: 44px;
  height: 44px;
  margin-bottom: var(--space-4);
  border-radius: var(--radius-md);
  color: #fff;
  background: var(--primary-600);
  font-size: 18px;
  font-weight: 700;
  place-items: center;
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

.inline-alert {
  margin-bottom: var(--space-4);
}

.inline-alert p {
  margin: var(--space-1) 0 0;
}

.password-control {
  position: relative;
}

.password-control .text-control {
  padding-right: 64px;
}

.password-toggle {
  position: absolute;
  inset: 0 4px 0 auto;
  min-width: 52px;
  border: 0;
  color: var(--primary-700);
  background: transparent;
  font-weight: 600;
  cursor: pointer;
}

.login-card :deep(.el-button) {
  width: 100%;
  min-height: 44px;
}

.login-footnote {
  margin: var(--space-5) 0 0;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-helper);
  text-align: center;
}

@media (max-width: 820px) {
  .login-page {
    grid-template-columns: 1fr;
    background: var(--color-bg-page);
  }

  .login-brand {
    display: block;
    width: 100%;
    padding: var(--space-6);
    border-radius: var(--radius-xl);
    background: var(--primary-900);
  }

  .login-brand strong,
  .login-brand p {
    display: none;
  }
}

@media (max-width: 480px) {
  .login-page {
    padding: var(--space-4);
  }

  .login-card {
    padding: var(--space-6);
  }
}
</style>
