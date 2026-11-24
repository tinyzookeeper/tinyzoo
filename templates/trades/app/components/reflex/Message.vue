<script setup lang="ts">
// A short message in place of a page: an address that leads nowhere, an error.
defineProps<{ code?: string; title: string; text: string; action: string }>()
defineEmits<{ act: [] }>()
</script>

<template>
  <section class="wrap pt-14 pb-24 md:pt-20 lg:pb-36">
    <p v-if="code" class="label">{{ code }}</p>
    <h1 class="h2 mt-3 !text-[clamp(2.6rem,7vw,6rem)]">{{ title }}</h1>
    <p class="mt-6 max-w-[34rem] text-[1.1875rem] leading-[1.4] font-medium">{{ text }}</p>
    <p class="mt-8"><button type="button" class="btn btn-ink cursor-pointer" @click="$emit('act')">{{ action }}</button></p>
  </section>
</template>
