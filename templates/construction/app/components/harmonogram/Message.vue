<script setup lang="ts">
// A short message in place of a page: an address that leads nowhere, an error.
defineProps<{ code?: string; title: string; text: string; action: string }>()
defineEmits<{ act: [] }>()
</script>

<template>
  <div class="overflow-x-clip">
  <section class="wrap py-20 lg:py-28">
    <p v-if="code" class="mono !text-brand">{{ code }}</p>
    <div class="laser-h mt-6" aria-hidden="true" />
    <h1 class="mt-8 text-[48px] font-extrabold leading-[.95] tracking-[-.04em] text-text sm:text-[72px]">{{ title }}</h1>
    <p class="mt-6 max-w-[30em] text-[17px] leading-[1.6] text-quiet">{{ text }}</p>
    <p class="mt-9"><button type="button" class="btn btn-brand" @click="$emit('act')">{{ action }}</button></p>
  </section>
  </div>
</template>
