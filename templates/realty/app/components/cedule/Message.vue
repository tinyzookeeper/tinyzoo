<script setup lang="ts">
// A short message in place of a page: an address that leads nowhere, an error.
defineProps<{ code?: string; title: string; text: string; action: string }>()
defineEmits<{ act: [] }>()
</script>

<template>
  <section class="wrap py-14 md:py-24">
    <p v-if="code" class="mono caps">{{ code }}</p>
    <h1 class="mt-5 text-[3.2rem] md:text-[5rem] tracking-[-0.05em] leading-[0.9]">{{ title }}</h1>
    <p class="mt-6 text-[1.1rem] font-medium max-w-[34rem]">{{ text }}</p>
    <p class="mt-8"><button type="button" class="btn" @click="$emit('act')">{{ action }} <UIcon name="i-lucide-arrow-right" class="ic size-4" aria-hidden="true" /></button></p>
  </section>
</template>
