<script setup lang="ts">
// A short message in place of a page: an address that leads nowhere, an error.
defineProps<{ code?: string; title: string; text: string; action: string }>()
defineEmits<{ act: [] }>()
</script>

<template>
  <section class="wrap py-20 md:py-32">
    <p v-if="code" class="hand text-[1.2rem]">{{ code }}</p>
    <h1 class="mt-2 text-[2.3rem] md:text-[3.2rem]">{{ title }}</h1>
    <p class="mt-5 text-quiet max-w-[34rem]">{{ text }}</p>
    <p class="mt-8"><button type="button" class="btn" @click="$emit('act')">{{ action }} <UIcon name="i-lucide-arrow-right" class="ic size-4" aria-hidden="true" /></button></p>
  </section>
</template>
