<script setup lang="ts">
// A short message in place of a page: an address that leads nowhere, an error.
defineProps<{ code?: string; title: string; text: string; action: string }>()
defineEmits<{ act: [] }>()
</script>

<template>
  <section class="wrap py-24 lg:py-36">
    <p v-if="code" class="kicker text-brand">{{ code }}</p>
    <h1 class="mt-3 text-[42px] sm:text-[60px] max-w-[13em]">{{ title }}</h1>
    <p class="mt-5 text-[17px] max-w-[28em]">{{ text }}</p>
    <p class="mt-9"><button type="button" class="btn btn-brand" @click="$emit('act')">{{ action }}</button></p>
  </section>
</template>
