<script setup lang="ts">
defineProps<{ field: any; entity?: string }>()
const model = defineModel<any>()
</script>

<template>
  <UInput v-model.number="model" type="number" class="w-full" />
</template>
