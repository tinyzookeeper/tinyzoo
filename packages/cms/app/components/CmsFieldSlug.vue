<script setup lang="ts">
defineProps<{ field: any; entity?: string }>()
const model = defineModel<any>()
</script>

<template>
  <UInput v-model="model" placeholder="lowercase-with-dashes" class="w-full" />
</template>
