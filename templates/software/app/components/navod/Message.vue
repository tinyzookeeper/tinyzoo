<script setup lang="ts">
// A short message in place of a page: an address that leads nowhere, an error.
defineProps<{ code?: string; title: string; text: string; action: string }>()
defineEmits<{ act: [] }>()
</script>

<template>
  <section class="wrap py-24 lg:py-36">
    <p v-if="code" class="label text-brand">{{ code }}</p>
    <h1 class="mt-4 text-[40px] font-semibold leading-[1.04] tracking-[-0.035em] text-ink sm:text-[52px]">{{ title }}</h1>
    <p class="mt-6 max-w-[34rem] text-[18px]">{{ text }}</p>
    <p class="mt-8"><button type="button" class="btn btn-main" @click="$emit('act')">{{ action }}</button></p>
  </section>
</template>
