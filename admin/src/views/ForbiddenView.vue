<script setup lang="ts">
import UiStatePanel from '@/components/UiStatePanel.vue'
</script>

<template>
  <section class="surface-card forbidden-page">
    <div class="forbidden-code" aria-hidden="true">
      <strong>403</strong>
      <span>访问受限</span>
    </div>
    <UiStatePanel
      kind="forbidden"
      title="暂无访问权限"
      description="当前收银员账号只能处理订单。如需访问门店管理功能，请联系老板账号处理。"
      action-label="返回订单管理"
      @action="$router.replace('/orders')"
    />
    <p class="store-name">鲁能超市李老家分店</p>
  </section>
</template>

<style scoped>
.forbidden-page {
  max-width: 720px;
  margin: min(12vh, 96px) auto 0;
  padding: 48px;
  text-align: center;
}

.forbidden-code {
  display: inline-flex;
  align-items: baseline;
  gap: 12px;
  color: var(--primary-700);
}

.forbidden-code strong {
  font-size: clamp(52px, 8vw, 88px);
  line-height: 1;
  letter-spacing: -0.06em;
}

.forbidden-code span,
.store-name {
  color: var(--color-text-secondary);
}

.store-name {
  margin: 4px 0 0;
  font-size: 13px;
}

@media (max-width: 760px) {
  .forbidden-page {
    margin-top: 24px;
    padding: 32px 20px;
  }
}
</style>
