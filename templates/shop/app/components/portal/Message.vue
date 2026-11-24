<script setup lang="ts">
// A short message in place of a page: an address that leads nowhere, an error.
defineProps<{ code?: string; title: string; text: string; action: string }>()
defineEmits<{ act: [] }>()
</script>

<template>
  <section class="wrap py-24 text-center md:py-32">
    <p v-if="code" class="caps text-brass">{{ code }}</p>
    <h1 class="mt-4 text-[2.2rem] md:text-[3.1rem]">{{ title }}</h1>
    <p class="mx-auto mt-5 max-w-xl text-cream/80">{{ text }}</p>
    <p class="mt-9"><button type="button" class="btn" @click="$emit('act')">{{ action }}</button></p>
  </section>
</template>
