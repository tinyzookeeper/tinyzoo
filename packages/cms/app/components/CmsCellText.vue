<script setup lang="ts">
const props = defineProps<{ field: any; row: any; entity?: string }>()
const v = computed(() => props.row[props.field.key])
</script>

<template>
  <span>{{ v == null || v === '' ? '—' : typeof v === 'object' ? '{…}' : String(v) }}</span>
</template>
