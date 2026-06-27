<script setup lang="ts">
const props = defineProps<{ field: any; row: any; entity?: string }>()
const excerpt = computed(() => {
  const t = props.row[props.field.key]?.content?.[0]?.content?.[0]?.text
  if (!t) return '—'
  return t.length > 60 ? `${t.slice(0, 60)}…` : t
})
</script>

<template>
  <span class="text-muted">{{ excerpt }}</span>
</template>
