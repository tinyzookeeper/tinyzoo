<script setup lang="ts">
// A short message in place of a page: an address that leads nowhere, an error.
defineProps<{ code?: string; title: string; text: string; action: string }>()
defineEmits<{ act: [] }>()
</script>

<template>
  <section class="wrap py-20 lg:py-28">
    <p v-if="code" class="label text-quiet"><span class="ticks" />{{ code }}</p>
    <h1 class="mt-6 font-display text-[38px] leading-[1.1] tracking-[-0.01em] sm:text-[48px]">{{ title }}</h1>
    <p class="mt-6 max-w-[58ch] text-[18px] leading-[1.6] text-ink/85">{{ text }}</p>
    <p class="mt-8"><button type="button" class="btn btn-brand" @click="$emit('act')">{{ action }}</button></p>
  </section>
</template>
