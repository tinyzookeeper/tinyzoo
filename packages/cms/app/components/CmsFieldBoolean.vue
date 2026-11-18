<script setup lang="ts">
defineProps<{ field: any; entity?: string; readOnly?: boolean }>()
const model = defineModel<any>()
</script>

<template>
  <USwitch v-model="model" class="shrink-0" />
</template>
