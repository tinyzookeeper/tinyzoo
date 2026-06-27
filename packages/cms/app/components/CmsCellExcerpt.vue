<script setup lang="ts">
const props = defineProps<{ field: any; row: any; entity?: string }>()

// Walk the TipTap doc and collect text so headings/lists also yield a preview.
function collectText(node: any): string {
  if (!node) return ''
  if (typeof node.text === 'string') return node.text
  if (Array.isArray(node.content)) return node.content.map(collectText).join(' ')
  return ''
}

const excerpt = computed(() => {
  const t = collectText(props.row[props.field.key]).trim()
  if (!t) return '—'
  return t.length > 60 ? `${t.slice(0, 60)}…` : t
})
</script>

<template>
  <span class="text-muted">{{ excerpt }}</span>
</template>
