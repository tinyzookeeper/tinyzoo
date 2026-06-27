<script setup lang="ts">
const props = defineProps<{ field: any; row: any; entity?: string }>()
const v = computed(() => props.row[props.field.key])
</script>

<template>
  <span class="text-muted">{{ v ? new Date(v).toLocaleDateString() : '—' }}</span>
</template>
