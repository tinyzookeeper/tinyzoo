<script setup lang="ts">
// A select value as a badge, in the option's admin label. "Live" values read green.
const props = defineProps<{ field: any; row: any; entity?: string }>()
const { t, tl } = useCmsI18n()
const good = new Set(['published', 'active', 'live', 'on'])
const value = computed(() => props.row[props.field.key])
const label = computed(() => tl(props.field.meta?.labels?.[value.value], String(value.value)))
</script>

<template>
  <UBadge v-if="value" :color="good.has(String(value)) ? 'success' : 'neutral'" variant="subtle" class="rounded-full">
    {{ label }}
  </UBadge>
  <span v-else class="text-dimmed">{{ t('common.none') }}</span>
</template>
