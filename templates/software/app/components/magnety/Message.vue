<script setup lang="ts">
// A short message in place of a page: an address that leads nowhere, an error.
defineProps<{ code?: string; title: string; text: string; action: string }>()
defineEmits<{ act: [] }>()
</script>

<template>
  <section class="bg-brand">
    <div class="wrap py-20 lg:py-32">
      <p v-if="code" class="mono"><span class="rounded-full bg-ink px-2.5 py-1 text-cream">{{ code }}</span></p>
      <h1 class="q mt-5 text-[44px] sm:text-[64px] lg:text-[84px]">{{ title }}</h1>
      <p class="mt-6 max-w-[34rem] text-[19px] font-medium">{{ text }}</p>
      <p class="mt-8"><button type="button" class="btn btn-ink" @click="$emit('act')">{{ action }}</button></p>
    </div>
  </section>
</template>
