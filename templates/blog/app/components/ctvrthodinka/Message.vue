<script setup lang="ts">
// A short message in place of a page: an address that leads nowhere, an error.
defineProps<{ code?: string; title: string; text: string; action: string }>()
defineEmits<{ act: [] }>()
</script>

<template>
  <section class="wrap py-24 lg:py-36">
    <p v-if="code" class="tag">{{ code }}</p>
    <h1 class="mt-5 text-[3.3rem] font-black leading-[0.94] tracking-[-0.045em] lg:text-[5.4rem]">{{ title }}</h1>
    <p class="stand mt-5 max-w-[34rem] text-[1.3rem] lg:text-[1.5rem]">{{ text }}</p>
    <p class="mt-8"><button type="button" class="inline-flex h-13 cursor-pointer items-center rounded-full bg-brand px-7 font-bold text-brand-ink transition-transform hover:-translate-y-0.5" @click="$emit('act')">{{ action }}</button></p>
  </section>
</template>
