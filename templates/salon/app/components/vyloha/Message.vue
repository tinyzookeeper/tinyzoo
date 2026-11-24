<script setup lang="ts">
// A short message in place of a page: an address that leads nowhere, an error.
defineProps<{ code?: string; title: string; text: string; action: string }>()
defineEmits<{ act: [] }>()
</script>

<template>
  <section class="wrap py-20 md:py-28">
    <div class="panel px-5 py-14 md:px-14 md:py-20 text-center" style="--r:26px">
      <p v-if="code" class="caps text-brass">{{ code }}</p>
      <h1 class="lettering mt-4 text-[44px] md:text-[64px] leading-[1.02]">{{ title }}</h1>
      <p class="mt-6 mx-auto max-w-[30rem]">{{ text }}</p>
      <p class="mt-8"><button type="button" class="plate btn btn-cream" @click="$emit('act')">{{ action }}</button></p>
    </div>
  </section>
</template>
