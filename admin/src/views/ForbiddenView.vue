<script setup lang="ts">
import UiStatePanel from '@/components/UiStatePanel.vue'
</script>

<template>
  <section class="surface-card forbidden-page">
    <UiStatePanel
      kind="forbidden"
      title="暂无访问权限"
      description="当前收银员账号只能处理订单。如需访问门店管理功能，请联系老板账号处理。"
      action-label="返回订单管理"
      @action="$router.replace('/orders')"
    />
  </section>
</template>

<style scoped>
.forbidden-page {
  max-width: 720px;
  margin: min(12vh, 96px) auto 0;
}
</style>
