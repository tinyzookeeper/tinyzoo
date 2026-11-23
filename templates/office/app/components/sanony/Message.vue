<script setup lang="ts">
// A short message in place of a page: an address that leads nowhere, an error.
defineProps<{ code?: string; title: string; text: string; action: string }>()
defineEmits<{ act: [] }>()
</script>

<template>
  <section class="wrap py-20 lg:py-32">
    <p v-if="code" class="kicker text-brand">{{ code }}</p>
    <h1 class="display mt-4 text-[46px] sm:text-[72px]">{{ title }}</h1>
    <p class="mt-6 max-w-[46ch] text-[18px] leading-[1.55]">{{ text }}</p>
    <p class="mt-8"><button type="button" class="btn btn-ink" @click="$emit('act')">{{ action }}</button></p>
  </section>
</template>
