<script setup lang="ts">
// A short message in place of a page: an address that leads nowhere, an error.
defineProps<{ code?: string; title: string; text: string; action: string }>()
defineEmits<{ act: [] }>()
</script>

<template>
  <section class="wrap py-24 lg:py-36 text-center">
    <p v-if="code" class="label text-brand">{{ code }}</p>
    <h1 class="text-[2.6rem] lg:text-[3.4rem] leading-[1.08] mt-4">{{ title }}</h1>
    <p class="mt-4 italic">{{ text }}</p>
    <p class="mt-9"><button type="button" class="btn label" @click="$emit('act')">{{ action }}</button></p>
  </section>
</template>
