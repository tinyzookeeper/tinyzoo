<script setup lang="ts">
// A short message in place of a page: an address that leads nowhere, an error.
defineProps<{ code?: string; title: string; text: string; action: string }>()
defineEmits<{ act: [] }>()
</script>

<template>
  <section class="wrap pt-40 pb-24 sm:pb-32">
    <p v-if="code" class="led text-[clamp(5rem,17vw,11rem)]">{{ code }}</p>
    <h1 class="h2 mt-6">{{ title }}</h1>
    <p class="mt-5 text-quiet max-w-[36rem]">{{ text }}</p>
    <p class="mt-8"><button type="button" class="btn" @click="$emit('act')">{{ action }}</button></p>
  </section>
</template>
