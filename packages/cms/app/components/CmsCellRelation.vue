<script setup lang="ts">
// To-one relations are populated as `${key}__label` by the list endpoint.
defineProps<{ field: any; row: any; entity?: string }>()
</script>

<template>
  <span>{{ row[`${field.key}__label`] ?? '—' }}</span>
</template>
