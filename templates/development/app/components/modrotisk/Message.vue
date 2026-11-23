<script setup lang="ts">
// A short message in place of a page: an address that leads nowhere, an error.
defineProps<{ code?: string; title: string; text: string; action: string }>()
defineEmits<{ act: [] }>()
</script>

<template>
  <section class="wrap pt-24 lg:pt-32 pb-24">
    <p v-if="code" class="label sheet"><b>{{ code }}</b></p>
    <h1 class="mt-8 text-[2.5rem] lg:text-[3.6rem]">{{ title }}</h1>
    <p class="mt-6 text-quiet max-w-[30rem]">{{ text }}</p>
    <p class="mt-9"><button type="button" class="btn" @click="$emit('act')">{{ action }}</button></p>
  </section>
</template>
