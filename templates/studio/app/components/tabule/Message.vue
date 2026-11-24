<script setup lang="ts">
// A short message in place of a page: an address that leads nowhere, an error.
defineProps<{ code?: string; title: string; text: string; action: string }>()
defineEmits<{ act: [] }>()
</script>

<template>
  <section class="wrap py-24 lg:py-32">
    <p v-if="code" class="mono">{{ code }}</p>
    <h1 class="h2 h2s mt-4">{{ title }}</h1>
    <p class="mt-6 max-w-[34rem] text-[1.1rem]">{{ text }}</p>
    <p class="mt-9"><button type="button" class="btn btn-ink" @click="$emit('act')">{{ action }}</button></p>
  </section>
</template>
