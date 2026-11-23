<script setup lang="ts">
// A short message in place of a page: an address that leads nowhere, an error.
defineProps<{ code?: string; title: string; text: string; action: string }>()
defineEmits<{ act: [] }>()
</script>

<template>
  <section class="wrap py-24 text-center lg:py-36">
    <p v-if="code" class="kicker text-brand">{{ code }}</p>
    <h1 class="mt-4 font-display text-[3rem] font-extralight leading-none tracking-[-0.025em] lg:text-[5.2rem]">{{ title }}</h1>
    <p class="mx-auto mt-6 max-w-[30rem] font-display text-[1.2rem] leading-[1.55]">{{ text }}</p>
    <p class="mt-9"><button type="button" class="inline-flex h-12 cursor-pointer items-center border border-ink px-6 transition-colors hover:bg-ink hover:text-paper" @click="$emit('act')">{{ action }}</button></p>
  </section>
</template>
