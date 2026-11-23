<script setup lang="ts">
// A short message in place of a page: an address that leads nowhere, an error.
defineProps<{ code?: string; title: string; text: string; action: string }>()
defineEmits<{ act: [] }>()
</script>

<template>
  <section class="wrap pt-20 lg:pt-28 pb-24">
    <p v-if="code" class="serif text-[4.4rem] lg:text-[7.6rem] leading-[0.92] text-brand num">{{ code }}</p>
    <h1 class="h2 mt-3">{{ title }}</h1>
    <p class="lead mt-5">{{ text }}</p>
    <p class="mt-8"><button type="button" class="btn" @click="$emit('act')">{{ action }}</button></p>
  </section>
</template>
