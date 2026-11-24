<script setup lang="ts">
// A short message in place of a page: an address that leads nowhere, an error.
defineProps<{ code?: string; title: string; text: string; action: string }>()
defineEmits<{ act: [] }>()
</script>

<template>
  <section class="wrap pt-12 pb-24 md:pt-20 md:pb-32">
    <p v-if="code" class="label">{{ code }}</p>
    <h1 class="h2 mt-4 max-w-[20ch]">{{ title }}</h1>
    <p class="mt-5 text-quiet max-w-[44ch]">{{ text }}</p>
    <p class="mt-9"><button type="button" class="btn" @click="$emit('act')">{{ action }}</button></p>
  </section>
</template>
