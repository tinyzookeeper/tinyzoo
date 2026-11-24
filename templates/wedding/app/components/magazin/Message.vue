<script setup lang="ts">
// A short message in place of a page: an address that leads nowhere, an error.
defineProps<{ code?: string; title: string; text: string; action: string }>()
defineEmits<{ act: [] }>()
</script>

<template>
  <section class="wrap py-24 lg:py-36">
    <p v-if="code" class="label text-brand">{{ code }}</p>
    <h1 class="h2 mt-5">{{ title }}</h1>
    <p class="mt-6">{{ text }}</p>
    <p class="mt-9"><button type="button" class="btn label" @click="$emit('act')">{{ action }}</button></p>
  </section>
</template>
