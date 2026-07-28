<script setup lang="ts">
type IconName =
  | 'menu'
  | 'close'
  | 'orders'
  | 'products'
  | 'categories'
  | 'inventory'
  | 'staff'
  | 'audit'
  | 'logout'
  | 'empty'
  | 'error'
  | 'forbidden'
  | 'search'
  | 'refresh'
  | 'plus'
  | 'chevron-left'

withDefaults(defineProps<{ name: IconName; size?: number; label?: string }>(), {
  size: 20,
  label: '',
})

const paths: Record<IconName, string[]> = {
  menu: ['M4 7h16M4 12h16M4 17h16'],
  close: ['M6 6l12 12M18 6 6 18'],
  orders: ['M7 3h10v4H7z', 'M5 5v16h14V5', 'M8 11h8M8 15h8M8 19h5'],
  products: ['M4 7.5 12 3l8 4.5v9L12 21l-8-4.5z', 'M4 7.5 12 12m8-4.5L12 12m0 9v-9'],
  categories: ['M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z'],
  inventory: ['M4 7h16v13H4z', 'M3 4h18v3H3z', 'M9 11h6'],
  staff: [
    'M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2',
    'M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M17 11l2 2 3-4',
  ],
  audit: ['M12 3 5 6v5c0 4.6 2.8 8.1 7 10 4.2-1.9 7-5.4 7-10V6z', 'm9 12 2 2 4-5'],
  logout: ['M10 17l5-5-5-5M15 12H3', 'M14 4h6v16h-6'],
  empty: ['M4 8h16v11H4z', 'M8 4h8l2 4H6z', 'M9 13h6'],
  error: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 7v6M12 17h.01'],
  forbidden: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M5 5l14 14'],
  search: ['M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16z', 'm21 21-4.35-4.35'],
  refresh: ['M20 7v5h-5', 'M4 17v-5h5', 'M6.1 9A7 7 0 0 1 18 6l2 1M4 17l2 1a7 7 0 0 0 11.9-3'],
  plus: ['M12 5v14M5 12h14'],
  'chevron-left': ['m15 18-6-6 6-6'],
}
</script>

<template>
  <svg
    class="app-icon"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    :aria-hidden="label ? undefined : 'true'"
    :role="label ? 'img' : undefined"
  >
    <title v-if="label">{{ label }}</title>
    <path v-for="path in paths[name]" :key="path" :d="path" />
  </svg>
</template>

<style scoped>
.app-icon {
  display: block;
  flex: 0 0 auto;
}
</style>
