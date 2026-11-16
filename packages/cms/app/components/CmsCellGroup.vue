<script setup lang="ts">
// A group in a list: its first few filled-in values on one line ("Dlouhá 1 · Tábor").
const props = defineProps<{ field: any; row: any; entity?: string }>()
const summary = computed(() => {
  const value = props.row[props.field.key]
  if (!value || typeof value !== 'object') return ''
  const parts: string[] = []
  const walk = (fields: any[], v: Record<string, any>) => {
    for (const f of fields) {
      const x = v?.[f.key]
      if (typeof x === 'string' && x.trim() && f.type !== 'media') parts.push(x.trim())
      else if (f.type === 'group' && x && typeof x === 'object') walk(f.meta?.fields ?? [], x)
      if (parts.length >= 3) return
    }
  }
  walk(props.field.meta?.fields ?? [], value)
  return parts.slice(0, 3).join(' · ')
})
</script>

<template>
  <span class="block max-w-xs truncate text-muted">{{ summary }}</span>
</template>
