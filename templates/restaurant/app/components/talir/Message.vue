<script setup lang="ts">
// A short message in place of a page: an address that leads nowhere, an error.
defineProps<{ code?: string; title: string; text: string; action: string }>()
defineEmits<{ act: [] }>()
</script>

<template>
  <section class="wrap py-24 lg:py-36">
    <p v-if="code" class="num text-[1.6rem]">{{ code }}</p>
    <h1 class="wide mt-4 text-[2.9rem] lg:text-[5rem]">{{ title }}</h1>
    <p class="mt-6 max-w-[34rem] text-[1.15rem] font-medium">{{ text }}</p>
    <p class="mt-8"><button type="button" class="btn btn-ink cursor-pointer" @click="$emit('act')">{{ action }}</button></p>
  </section>
</template>
