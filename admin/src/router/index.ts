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
        redirect: '/orders',
      },
      {
        path: 'products',
        component: () => import('@/views/catalog/ProductView.vue'),
        meta: { ownerOnly: true, title: '商品管理' },
      },
      {
        path: 'categories',
        component: () => import('@/views/catalog/CategoryView.vue'),
        meta: { ownerOnly: true, title: '分类管理' },
      },
      {
        path: 'inventory',
        component: () => import('@/views/inventory/InventoryView.vue'),
        meta: { ownerOnly: true, title: '线上库存' },
      },
      {
        path: 'orders',
        name: 'orders',
        component: () => import('@/views/orders/OrderListView.vue'),
        meta: { title: '订单管理' },
      },
      {
        path: 'orders/:orderNo',
        component: () => import('@/views/orders/OrderDetailView.vue'),
        props: true,
        meta: { title: '订单详情' },
      },
      {
        path: 'staff',
        component: () => import('@/views/staff/StaffView.vue'),
        meta: { ownerOnly: true, title: '员工账号' },
      },
      {
        path: 'audit',
        component: () => import('@/views/audit/AuditLogView.vue'),
        meta: { ownerOnly: true, title: '操作审计' },
      },
      {
        path: 'forbidden',
        name: 'forbidden',
        component: () => import('@/views/ForbiddenView.vue'),
        meta: { title: '访问受限' },
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
      return '/forbidden'
    }
    return true
  })

  return router
}
