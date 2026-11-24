<script setup lang="ts">
// A short message in place of a page: an address that leads nowhere, an error.
defineProps<{ code?: string; title: string; text: string; action: string }>()
defineEmits<{ act: [] }>()
</script>

<template>
  <section class="wrap py-20 lg:py-32">
    <p v-if="code" class="cap">{{ code }}</p>
    <h1 class="wide mt-4 text-[clamp(30px,7vw,96px)]">{{ title }}</h1>
    <p class="mt-6 max-w-[34rem] text-[19px] font-medium leading-snug">{{ text }}</p>
    <p class="mt-9"><button type="button" class="btn btn-ink" @click="$emit('act')">{{ action }}</button></p>
  </section>
</template>
