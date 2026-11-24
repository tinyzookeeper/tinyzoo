<script setup lang="ts">
// A short message in place of a page: an address that leads nowhere, an error.
defineProps<{ code?: string; title: string; text: string; action: string }>()
defineEmits<{ act: [] }>()
</script>

<template>
  <section class="wrap py-20 md:py-28">
    <p v-if="code" class="label text-brand">{{ code }}</p>
    <h1 class="mt-3 text-[2.1rem] md:text-[2.75rem] leading-[1.1]">{{ title }}</h1>
    <p class="mt-5 max-w-[34rem]">{{ text }}</p>
    <p class="mt-8"><button type="button" class="btn" @click="$emit('act')">{{ action }}</button></p>
  </section>
</template>
