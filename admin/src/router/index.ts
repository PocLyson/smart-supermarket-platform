import { h } from 'vue'
import {
  createMemoryHistory,
  createRouter,
  createWebHistory,
  type Router,
  type RouteRecordRaw,
} from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import AdminLayout from '@/layouts/AdminLayout.vue'

const ownerOnlyRoutes = ['/products', '/categories', '/inventory', '/staff', '/audit']

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { public: true },
  },
  {
    path: '/',
    component: AdminLayout,
    children: [
      {
        path: '',
        redirect: () => {
          const auth = useAuthStore()
          return auth.isOwner ? '/products' : '/orders'
        },
      },
      {
        path: 'products',
        component: () => import('@/views/catalog/ProductView.vue'),
        meta: { ownerOnly: true },
      },
      {
        path: 'categories',
        component: () => import('@/views/catalog/CategoryView.vue'),
        meta: { ownerOnly: true },
      },
      {
        path: 'inventory',
        component: () => import('@/views/inventory/InventoryView.vue'),
        meta: { ownerOnly: true },
      },
      {
        path: 'orders',
        component: { render: () => h('div', { class: 'surface-card' }, '订单工作台待接入') },
      },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

export const createAdminRouter = (): Router => {
  const router = createRouter({
    history: import.meta.env.MODE === 'test' ? createMemoryHistory() : createWebHistory(),
    routes,
  })

  router.beforeEach((to) => {
    const auth = useAuthStore()
    if (to.meta.public) return auth.isAuthenticated ? '/' : true
    if (!auth.isAuthenticated) return '/login'
    if (
      (to.meta.ownerOnly || ownerOnlyRoutes.some((path) => to.path.startsWith(path))) &&
      !auth.isOwner
    ) {
      return '/orders'
    }
    return true
  })

  return router
}
