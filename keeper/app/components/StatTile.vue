<script setup lang="ts">
defineProps<{ label: string; value: string | number; icon: string; tone?: 'neutral' | 'success' | 'error' | 'warning' }>()
</script>

<template>
  <div class="rounded-xl border border-default bg-default p-4">
    <div class="flex items-center gap-2 text-sm text-muted">
      <span
        class="inline-flex size-7 items-center justify-center rounded-lg"
        :class="{
          'bg-elevated text-toned': !tone || tone === 'neutral',
          'bg-success/10 text-success': tone === 'success',
          'bg-error/10 text-error': tone === 'error',
          'bg-warning/10 text-warning': tone === 'warning',
        }"
      >
        <UIcon :name="icon" class="size-4" />
      </span>
      {{ label }}
    </div>
    <p class="mt-2 font-display text-2xl font-bold text-highlighted tabular">{{ value }}</p>
  </div>
</template>
