<script setup lang="ts">
// A short message in place of a page: an address that leads nowhere, an error.
defineProps<{ code?: string; title: string; text: string; action: string }>()
defineEmits<{ act: [] }>()
</script>

<template>
  <section class="wrap py-20 lg:py-32">
    <p v-if="code" class="eyebrow">{{ code }}</p>
    <h1 class="disp mt-4 text-[clamp(38px,5.2vw,72px)] !leading-[1.02]"><span class="slash" aria-hidden="true" />{{ title }}</h1>
    <p class="mt-6 max-w-[30rem] text-[18px] text-quiet">{{ text }}</p>
    <p class="mt-8"><button type="button" class="btn" @click="$emit('act')">{{ action }}</button></p>
  </section>
</template>
