<script setup lang="ts">
// A short message in place of a page: an address that leads nowhere, an error.
defineProps<{ code?: string; title: string; text: string; action: string }>()
defineEmits<{ act: [] }>()
</script>

<template>
  <section class="wrap py-24 lg:py-36">
    <p v-if="code" class="inline-block rounded-full bg-ink text-paper font-extrabold uppercase tracking-[.1em] text-[.78rem] px-3 py-1">{{ code }}</p>
    <h1 class="mt-4 text-[2.5rem] sm:text-[3.2rem] lg:text-[3.6rem]">{{ title }}</h1>
    <p class="mt-4 text-[1.08rem] max-w-[34rem]">{{ text }}</p>
    <p class="mt-8"><button type="button" class="btn btn-brand" @click="$emit('act')">{{ action }}</button></p>
  </section>
</template>
