<script setup lang="ts">
// A short message in place of a page: an address that leads nowhere, an error. It is a
// question in a bubble, as every section of this look is, and the answer under it.
defineProps<{ code?: string; title: string; text: string; action: string }>()
defineEmits<{ act: [] }>()
</script>

<template>
  <section class="wrap py-24 lg:py-36">
    <p v-if="code" class="kicker text-quiet">{{ code }}</p>
    <h1 class="bubble bubble-q mt-3">{{ title }}</h1>
    <p class="answer mt-6 max-w-[34rem]">{{ text }}</p>
    <p class="mt-9"><button type="button" class="btn" @click="$emit('act')">{{ action }}</button></p>
  </section>
</template>
