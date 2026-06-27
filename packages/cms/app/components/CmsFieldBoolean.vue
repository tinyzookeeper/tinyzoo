<script setup lang="ts">
defineProps<{ field: any; entity?: string }>()
const model = defineModel<any>()
</script>

<template>
  <USwitch v-model="model" />
</template>
