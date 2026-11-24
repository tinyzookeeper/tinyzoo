<script setup lang="ts">
// A short message in place of a page: an address that leads nowhere, an error.
defineProps<{ code?: string; title: string; text: string; action: string }>()
defineEmits<{ act: [] }>()
</script>

<template>
  <section class="wrap py-24 lg:py-36">
    <p v-if="code" class="label !text-brand">{{ code }}</p>
    <h1 class="h2 mt-3">{{ title }}</h1>
    <p class="serif mt-5 max-w-[34rem]">{{ text }}</p>
    <p class="mt-8"><button type="button" class="btn btn-brand cursor-pointer" @click="$emit('act')">{{ action }}</button></p>
  </section>
</template>
