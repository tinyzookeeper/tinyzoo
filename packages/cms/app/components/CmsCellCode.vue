<script setup lang="ts">
defineProps<{ field: any; row: any; entity?: string }>()
</script>

<template>
  <code class="text-xs text-muted">{{ row[field.key] }}</code>
</template>
