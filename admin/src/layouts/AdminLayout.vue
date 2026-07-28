<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import AppIcon from '@/components/AppIcon.vue'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const mobileOpen = ref(false)
const pageTitle = computed(() => String(route.meta.title ?? '管理后台'))
const roleLabel = computed(() => (auth.isOwner ? '老板' : '收银员'))

watch(
  () => route.fullPath,
  () => {
    mobileOpen.value = false
  },
)

const logout = async (): Promise<void> => {
  auth.clearSession()
  await router.replace('/login')
}
</script>

<template>
  <div class="admin-shell">
    <a class="skip-link" href="#main-content">跳到主要内容</a>
    <header class="mobile-header">
      <button
        class="icon-button"
        type="button"
        :aria-expanded="mobileOpen"
        aria-controls="admin-sidebar"
        aria-label="打开主菜单"
        @click="mobileOpen = true"
      >
        <AppIcon name="menu" />
      </button>
      <div class="mobile-brand">
        <strong>智慧超市</strong><span>{{ pageTitle }}</span>
      </div>
    </header>
    <div v-if="mobileOpen" class="sidebar-scrim" aria-hidden="true" @click="mobileOpen = false" />
    <aside id="admin-sidebar" class="sidebar" :class="{ 'is-open': mobileOpen }">
      <div class="brand-block">
        <div class="brand-mark" aria-hidden="true">智</div>
        <div><strong>智慧超市</strong><span>鲁能超市李老家分店</span></div>
        <button
          class="icon-button sidebar-close"
          type="button"
          aria-label="关闭主菜单"
          @click="mobileOpen = false"
        >
          <AppIcon name="close" />
        </button>
      </div>
      <nav class="nav-list" aria-label="后台主菜单">
        <RouterLink to="/orders"><AppIcon name="orders" />订单管理</RouterLink>
        <template v-if="auth.isOwner">
          <RouterLink to="/products"><AppIcon name="products" />商品管理</RouterLink>
          <RouterLink to="/categories"><AppIcon name="categories" />分类管理</RouterLink>
          <RouterLink to="/inventory"><AppIcon name="inventory" />线上库存</RouterLink>
          <RouterLink to="/staff"><AppIcon name="staff" />员工账号</RouterLink>
          <RouterLink to="/audit"><AppIcon name="audit" />操作审计</RouterLink>
        </template>
      </nav>
      <div class="account">
        <div class="account-copy">
          <span>{{ roleLabel }}</span
          ><strong>{{ auth.session?.username }}</strong>
        </div>
        <el-button text aria-label="退出登录" @click="logout">
          <AppIcon name="logout" />退出
        </el-button>
      </div>
    </aside>
    <div class="workspace">
      <header class="topbar">
        <div>
          <span>门店运营中心</span><strong>{{ pageTitle }}</strong>
        </div>
        <div class="topbar-account">
          <span>{{ roleLabel }}</span
          ><strong>{{ auth.session?.username }}</strong>
        </div>
      </header>
      <main id="main-content" class="content" tabindex="-1"><RouterView /></main>
    </div>
  </div>
</template>

<style scoped>
.admin-shell {
  display: grid;
  grid-template-columns: var(--layout-sidebar-width) minmax(0, 1fr);
  min-height: 100dvh;
}
.sidebar {
  position: sticky;
  top: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  height: 100dvh;
  padding: var(--space-5) var(--space-3) var(--space-4);
  color: var(--color-text-inverse);
  background: var(--color-bg-sidebar);
  z-index: 60;
}
.brand-block {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: 0 var(--space-2) var(--space-4);
  border-bottom: 1px solid rgb(255 255 255 / 12%);
}
.brand-block > div:not(.brand-mark),
.account-copy,
.mobile-brand {
  display: grid;
}
.brand-block strong {
  font-size: 17px;
}
.brand-block span,
.account-copy span {
  color: rgb(255 255 255 / 66%);
  font-size: 12px;
}
.brand-mark {
  display: grid;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  color: var(--primary-800);
  background: var(--primary-100);
  font-weight: 700;
  place-items: center;
}
.nav-list {
  display: grid;
  gap: var(--space-1);
}
.nav-list a {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-height: 44px;
  padding: 0 var(--space-3);
  border-left: 3px solid transparent;
  border-radius: var(--radius-sm);
  color: rgb(255 255 255 / 78%);
  font-weight: 500;
  text-decoration: none;
  transition:
    background 180ms var(--ease-standard),
    color 180ms var(--ease-standard);
}
.nav-list a:hover {
  color: #fff;
  background: rgb(255 255 255 / 8%);
}
.nav-list a.router-link-active {
  border-left-color: var(--primary-300);
  color: #fff;
  background: var(--primary-700);
  font-weight: 600;
}
.account {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  margin-top: auto;
  padding: var(--space-3) var(--space-2) 0;
  border-top: 1px solid rgb(255 255 255 / 12%);
}
.account-copy {
  min-width: 0;
}
.account-copy strong {
  overflow: hidden;
  text-overflow: ellipsis;
}
.account :deep(.el-button) {
  color: #fff;
}
.workspace {
  min-width: 0;
}
.topbar {
  position: sticky;
  top: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 64px;
  padding: 0 var(--space-6);
  border-bottom: 1px solid var(--color-divider);
  background: rgb(255 255 255 / 96%);
  z-index: 20;
}
.topbar > div {
  display: flex;
  align-items: baseline;
  gap: var(--space-3);
}
.topbar span {
  color: var(--color-text-tertiary);
  font-size: var(--font-size-helper);
}
.topbar strong {
  font-size: var(--font-size-card-title);
}
.topbar-account {
  padding-left: var(--space-4);
  border-left: 1px solid var(--color-divider);
}
.content {
  width: min(100%, calc(var(--layout-content-max) + var(--space-12)));
  min-width: 0;
  margin-inline: auto;
  padding: var(--space-6);
}
.mobile-header,
.sidebar-close,
.sidebar-scrim {
  display: none;
}
@media (max-width: 760px) {
  .admin-shell {
    grid-template-columns: 1fr;
  }
  .mobile-header {
    position: sticky;
    top: 0;
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: 60px;
    padding: var(--space-2) var(--space-4);
    border-bottom: 1px solid var(--color-divider);
    background: var(--color-bg-surface);
    z-index: 40;
  }
  .mobile-brand span {
    color: var(--color-text-secondary);
    font-size: 12px;
  }
  .sidebar {
    position: fixed;
    inset: 0 auto 0 0;
    width: min(86vw, 304px);
    visibility: hidden;
    transform: translateX(-100%);
    transition: transform 240ms var(--ease-standard);
  }
  .sidebar.is-open {
    visibility: visible;
    transform: translateX(0);
  }
  .sidebar-close {
    display: grid;
    margin-left: auto;
    color: #fff;
  }
  .sidebar-scrim {
    position: fixed;
    inset: 0;
    display: block;
    background: var(--color-mask);
    z-index: 50;
  }
  .topbar {
    display: none;
  }
  .content {
    padding: var(--space-4);
  }
}
</style>
