<script setup lang="ts">
// A short message in place of a page: an address that leads nowhere, an error.
defineProps<{ code?: string; title: string; text: string; action: string }>()
defineEmits<{ act: [] }>()
</script>

<template>
  <section class="wrap py-20 lg:py-28">
    <p v-if="code" class="lab">{{ code }}</p>
    <h1 class="mt-4 font-display text-[38px] font-light leading-[1.08] tracking-[-.025em] text-ink sm:text-[50px]">{{ title }}</h1>
    <p class="mt-6 max-w-[30em] text-[17px] leading-[1.65]">{{ text }}</p>
    <p class="mt-9"><button type="button" class="btn btn-ink" @click="$emit('act')">{{ action }}</button></p>
  </section>
</template>
