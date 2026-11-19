<script setup lang="ts">
export interface Fact {
  label: string
  value: string | number
  tone?: 'default' | 'warning' | 'error' | 'success' | 'muted'
  mono?: boolean
}
defineProps<{ facts: Fact[] }>()
</script>

<template>
  <dl class="divide-y divide-default text-sm">
    <div v-for="f in facts" :key="f.label" class="flex items-baseline justify-between gap-4 py-2 first:pt-0 last:pb-0">
      <dt class="text-muted">{{ f.label }}</dt>
      <dd
        class="text-right tabular"
        :class="[
          f.mono && 'font-mono text-xs',
          { 'text-highlighted': !f.tone || f.tone === 'default', 'text-warning font-medium': f.tone === 'warning', 'text-error font-medium': f.tone === 'error', 'text-success': f.tone === 'success', 'text-muted': f.tone === 'muted' },
        ]"
      >
        {{ f.value }}
      </dd>
    </div>
  </dl>
</template>
