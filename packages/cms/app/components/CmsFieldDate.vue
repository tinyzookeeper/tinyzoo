<script setup lang="ts">
defineProps<{ field: any; entity?: string }>()
const model = defineModel<any>()
</script>

<template>
  <UInput v-model="model" type="datetime-local" class="w-full" />
</template>
