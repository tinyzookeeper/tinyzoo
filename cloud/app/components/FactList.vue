<script setup lang="ts">
export interface Fact { label: string; value: string | number; mono?: boolean; to?: string }
defineProps<{ facts: Fact[] }>()
</script>

<template>
  <dl class="divide-y divide-default text-sm">
    <div v-for="f in facts" :key="f.label" class="flex items-baseline justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
      <dt class="shrink-0 text-muted">{{ f.label }}</dt>
      <dd class="min-w-0 text-right text-highlighted tabular" :class="f.mono && 'font-mono text-[0.8125rem]'">
        <a v-if="f.to" :href="f.to" target="_blank" rel="noopener" class="underline decoration-(--ui-border-accented) underline-offset-4 hover:decoration-current">{{ f.value }}</a>
        <template v-else>{{ f.value }}</template>
      </dd>
    </div>
  </dl>
</template>
