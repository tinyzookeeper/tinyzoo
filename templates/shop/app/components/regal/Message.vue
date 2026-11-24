<script setup lang="ts">
// A short message in place of a page: an address that leads nowhere, an error.
defineProps<{ code?: string; title: string; text: string; action: string }>()
defineEmits<{ act: [] }>()
</script>

<template>
  <section class="wrap py-20 md:py-28">
    <p v-if="code" class="num text-[clamp(5rem,20vw,9rem)] text-rail">{{ code }}</p>
    <h1 class="mt-4 text-[2.3rem] font-bold tracking-[-0.035em] md:text-[3.5rem]">{{ title }}</h1>
    <p class="mt-5 max-w-xl text-[1.1rem] leading-snug">{{ text }}</p>
    <p class="mt-8"><button type="button" class="btn" @click="$emit('act')">{{ action }}</button></p>
  </section>
</template>
