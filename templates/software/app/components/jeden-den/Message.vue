<script setup lang="ts">
// A short message in place of a page: an address that leads nowhere, an error.
defineProps<{ code?: string; title: string; text: string; action: string }>()
defineEmits<{ act: [] }>()
</script>

<template>
  <section class="bg-dawn">
    <div class="wrap py-20 lg:py-32">
      <p v-if="code" class="time text-brand">{{ code }}</p>
      <h1 class="mt-3 font-display text-[40px] font-semibold leading-[1.06] tracking-[-0.015em] sm:text-[54px]">{{ title }}</h1>
      <p class="mt-6 max-w-[33rem] text-[18px]">{{ text }}</p>
      <p class="mt-8"><button type="button" class="btn btn-brand" @click="$emit('act')">{{ action }}</button></p>
    </div>
  </section>
</template>
