<script setup lang="ts">
// A short message in place of a page: an address that leads nowhere, an error.
defineProps<{ code?: string; title: string; text: string; action: string }>()
defineEmits<{ act: [] }>()
</script>

<template>
  <section class="wrap py-24 lg:py-36">
    <p v-if="code" class="mono text-quiet">{{ code }}</p>
    <h1 class="mt-5 text-[2.9rem] md:text-[4.5rem] lg:text-[5.6rem] tracking-[-0.05em]"><span class="hl">{{ title }}</span></h1>
    <p class="mt-8 text-[1.2rem] font-medium max-w-[32rem]">{{ text }}</p>
    <p class="mt-9"><button type="button" class="btn" @click="$emit('act')">{{ action }}</button></p>
  </section>
</template>
