<script setup lang="ts">
// A short message in place of a page: an address that leads nowhere, an error.
defineProps<{ code?: string; title: string; text: string; action: string }>()
defineEmits<{ act: [] }>()
</script>

<template>
  <section class="wrap py-24 lg:py-36">
    <p v-if="code" class="kicker">{{ code }}</p>
    <h1 class="mt-2 text-[2.5rem] sm:text-[3rem] lg:text-[3.5rem]">{{ title }}</h1>
    <p class="mt-5 text-[1.15rem] max-w-[32rem]">{{ text }}</p>
    <p class="mt-8"><button type="button" class="btn btn-brand" @click="$emit('act')">{{ action }}</button></p>
  </section>
</template>
