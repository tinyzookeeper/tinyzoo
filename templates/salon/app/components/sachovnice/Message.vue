<script setup lang="ts">
// A short message in place of a page: an address that leads nowhere, an error.
defineProps<{ code?: string; title: string; text: string; action: string }>()
defineEmits<{ act: [] }>()
</script>

<template>
  <section class="wrap py-20 md:py-28">
    <p v-if="code" class="tag inline-flex items-center gap-3"><span class="w-2.5 h-2.5 bg-ink" />{{ code }}</p>
    <h1 class="mt-5 text-[40px] leading-[1] md:text-[72px]">{{ title }}</h1>
    <p class="mt-6 max-w-[30rem] text-[18px] font-semibold">{{ text }}</p>
    <p class="mt-8"><button type="button" class="btn btn-ink" @click="$emit('act')">{{ action }}</button></p>
  </section>
</template>
