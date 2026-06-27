<script setup lang="ts">
defineProps<{ field: any; entity?: string }>()
const model = defineModel<any>()
</script>

<template>
  <USelect v-model="model" :items="field.meta.options" class="w-full" />
</template>
