<script setup lang="ts">
defineProps<{ field: any; row: any; entity?: string }>()
</script>

<template>
  <span>{{ row[field.key] ?? '—' }}</span>
</template>
