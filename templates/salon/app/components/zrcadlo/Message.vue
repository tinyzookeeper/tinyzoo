<script setup lang="ts">
// A short message in place of a page: an address that leads nowhere, an error.
defineProps<{ code?: string; title: string; text: string; action: string }>()
defineEmits<{ act: [] }>()
</script>

<template>
  <section class="wrap py-24 md:py-32 text-center">
    <p v-if="code" class="label">{{ code }}</p>
    <h1 class="mt-4 text-[38px] md:text-[48px] leading-[1.08]">{{ title }}</h1>
    <p class="mt-5 mx-auto max-w-[30rem]">{{ text }}</p>
    <p class="mt-8"><button type="button" class="btn btn-brand" @click="$emit('act')">{{ action }}</button></p>
  </section>
</template>
