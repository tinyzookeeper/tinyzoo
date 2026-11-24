<script setup lang="ts">
// A short message in place of a page: an address that leads nowhere, an error. A card on a peg.
defineProps<{ code?: string; title: string; text: string; action: string }>()
defineEmits<{ act: [] }>()
</script>

<template>
  <section class="board py-16 md:py-24">
    <div class="wrap">
      <div class="plate swing mx-auto max-w-2xl px-6 py-10 text-center md:px-10 md:py-12" style="--r: 1.4deg">
        <span class="peg peg-l" /><span class="peg peg-r" />
        <p v-if="code" class="eyebrow">{{ code }}</p>
        <h1 class="mt-5 text-[2.3rem] md:text-[3.3rem]">{{ title }}</h1>
        <p class="mt-4 text-[1.1rem]">{{ text }}</p>
        <p class="mt-7"><button type="button" class="btn" @click="$emit('act')">{{ action }}</button></p>
      </div>
    </div>
  </section>
</template>
