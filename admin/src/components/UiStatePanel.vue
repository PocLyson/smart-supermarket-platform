<script setup lang="ts">
import AppIcon from './AppIcon.vue'

const props = withDefaults(
  defineProps<{
    kind: 'empty' | 'error' | 'forbidden'
    title: string
    description?: string
    actionLabel?: string
    compact?: boolean
  }>(),
  { description: '', actionLabel: '', compact: false },
)

defineEmits<{ action: [] }>()
</script>

<template>
  <section
    class="ui-state"
    :class="[`is-${props.kind}`, { 'is-compact': compact }]"
    :role="props.kind === 'error' ? 'alert' : 'status'"
    :aria-labelledby="`state-${props.kind}-title`"
  >
    <span class="ui-state__icon" :data-kind="props.kind">
      <AppIcon :name="props.kind" :size="compact ? 24 : 32" />
    </span>
    <div>
      <h2 :id="`state-${props.kind}-title`">{{ props.title }}</h2>
      <p v-if="props.description">{{ props.description }}</p>
    </div>
    <el-button v-if="props.actionLabel" @click="$emit('action')">{{ props.actionLabel }}</el-button>
  </section>
</template>

<style scoped>
.ui-state {
  display: grid;
  justify-items: center;
  gap: var(--space-3);
  min-height: 260px;
  padding: var(--space-10) var(--space-6);
  text-align: center;
  place-content: center;
}
.ui-state.is-compact {
  min-height: 160px;
  padding: var(--space-6);
}
.ui-state__icon {
  display: grid;
  width: 56px;
  height: 56px;
  border-radius: var(--radius-round);
  color: var(--primary-700);
  background: var(--primary-100);
  place-items: center;
}
.ui-state__icon[data-kind='error'],
.ui-state__icon[data-kind='forbidden'] {
  color: var(--error-text);
  background: var(--error-bg);
}
.ui-state h2 {
  margin: 0;
  font-size: var(--font-size-card-title);
  line-height: var(--line-height-card-title);
}
.ui-state p {
  max-width: 440px;
  margin: var(--space-1) 0 0;
  color: var(--color-text-secondary);
}
</style>
