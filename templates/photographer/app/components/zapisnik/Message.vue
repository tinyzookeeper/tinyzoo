<script setup lang="ts">
defineProps<{ code?: string; title: string; text: string; action: string }>()
defineEmits<{ act: [] }>()
</script>

<template>
  <section class="wrap py-20 md:py-32">
    <p v-if="code" class="hand text-brand text-[2.2rem] -rotate-2 origin-left mb-3">{{ code }}</p>
    <h1 class="text-[2.5rem] md:text-[3.6rem] leading-[1.06]">{{ title }}</h1>
    <p class="mt-5 text-[1.18rem]">{{ text }}</p>
    <p class="mt-8"><button type="button" class="btn" @click="$emit('act')">{{ action }}</button></p>
  </section>
</template>
