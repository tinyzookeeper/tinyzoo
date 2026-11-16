<script setup lang="ts">
// A select value in a list: a dot and its admin label. "Live" values get a green dot.
const props = defineProps<{ field: any; row: any; entity?: string }>()
const { t, tl } = useCmsI18n()
const live = new Set(['published', 'active', 'live', 'on'])
// Waiting for someone (a new form message): stands out until it is read.
const fresh = new Set(['new'])
const value = computed(() => props.row[props.field.key])
const label = computed(() => tl(props.field.meta?.labels?.[value.value], String(value.value)))
</script>

<template>
  <span v-if="value" class="inline-flex items-center gap-1.5 whitespace-nowrap" :class="fresh.has(String(value)) ? 'font-medium text-highlighted' : live.has(String(value)) ? 'text-default' : 'text-muted'">
    <span class="size-2 rounded-full shrink-0" :class="fresh.has(String(value)) ? 'bg-info' : live.has(String(value)) ? 'bg-success' : 'border border-(--ui-text-dimmed)'" aria-hidden="true" />
    {{ label }}
  </span>
  <span v-else class="text-dimmed">{{ t('common.none') }}</span>
</template>
