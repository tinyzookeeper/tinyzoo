<script setup lang="ts">
const props = defineProps<{ field: any; row: any; entity?: string }>()
const good = new Set(['published', 'active', 'live', 'on'])
const value = computed(() => props.row[props.field.key])
</script>

<template>
  <UBadge v-if="value" :color="good.has(String(value)) ? 'success' : 'neutral'" variant="subtle">
    {{ value }}
  </UBadge>
  <span v-else>—</span>
</template>
