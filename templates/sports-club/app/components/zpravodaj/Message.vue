<script setup lang="ts">
// A short message in place of a page: an address that leads nowhere, an error.
defineProps<{ code?: string; title: string; text: string; action: string }>()
defineEmits<{ act: [] }>()
</script>

<template>
  <section class="wrap py-20 lg:py-32">
    <p v-if="code" class="label">{{ code }}</p>
    <h1 class="h2 mt-4 text-[clamp(38px,6.2vw,76px)] !font-extrabold leading-[1.02] tracking-[-.02em]">{{ title }}</h1>
    <p class="mt-6 max-w-[34rem] text-lg leading-relaxed">{{ text }}</p>
    <p class="mt-9"><button type="button" class="btn btn-fill" @click="$emit('act')">{{ action }}</button></p>
  </section>
</template>
