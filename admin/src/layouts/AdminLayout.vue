<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

const logout = async (): Promise<void> => {
  auth.clearSession()
  await router.replace('/login')
}
</script>

<template>
  <div class="admin-shell">
    <aside class="sidebar">
      <div class="brand">智慧超市</div>
      <nav class="nav-list" aria-label="后台主菜单">
        <RouterLink to="/orders">订单处理</RouterLink>
        <template v-if="auth.isOwner">
          <RouterLink to="/products">商品管理</RouterLink>
          <RouterLink to="/categories">分类管理</RouterLink>
          <RouterLink to="/inventory">线上库存</RouterLink>
          <RouterLink to="/staff">员工账号</RouterLink>
          <RouterLink to="/audit">操作审计</RouterLink>
        </template>
      </nav>
      <div class="account">
        <span>{{ auth.session?.username }}</span>
        <el-button text @click="logout">退出登录</el-button>
      </div>
    </aside>
    <main class="content">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.admin-shell {
  display: grid;
  grid-template-columns: var(--layout-sidebar-width) 1fr;
  min-height: 100vh;
}

.sidebar {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  padding: var(--space-6) var(--space-4);
  color: var(--color-text-inverse);
  background: var(--color-bg-sidebar);
}

.brand {
  padding-inline: var(--space-2);
  font-size: 20px;
  font-weight: 700;
}

.nav-list {
  display: grid;
  gap: var(--space-2);
}

.nav-list a {
  padding: var(--space-3);
  border-radius: var(--radius-sm);
  color: var(--color-text-inverse);
  text-decoration: none;
}

.nav-list a.router-link-active {
  background: var(--color-brand);
}

.account {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: auto;
}

.content {
  width: min(100%, var(--layout-content-max));
  min-width: 0;
  padding: var(--space-6);
}

@media (max-width: 760px) {
  .admin-shell {
    grid-template-columns: 1fr;
  }

  .sidebar {
    position: static;
  }
}
</style>
