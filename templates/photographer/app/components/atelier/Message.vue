<script setup lang="ts">
// A short message in place of a page: an address that leads nowhere, an error.
defineProps<{ code?: string; title: string; text: string; action: string }>()
defineEmits<{ act: [] }>()
</script>

<template>
  <section class="wrap py-24 md:py-36 text-center">
    <p v-if="code" class="label text-quiet mb-4">{{ code }}</p>
    <h1 class="text-[2.4rem] md:text-[3.4rem] leading-none">{{ title }}</h1>
    <p class="mt-5">{{ text }}</p>
    <p class="mt-9"><button type="button" class="btn label" @click="$emit('act')">{{ action }}</button></p>
  </section>
</template>
