<script setup lang="ts">
// A short message in place of a page: an address that leads nowhere, an error.
defineProps<{ code?: string; title: string; text: string; action: string }>()
defineEmits<{ act: [] }>()
</script>

<template>
  <section class="wrap py-24 lg:py-36 text-center">
    <div class="orn" aria-hidden="true"><i /></div>
    <p v-if="code" class="label text-brand mt-8">{{ code }}</p>
    <h1 class="mt-5 font-display font-medium text-[2.6rem] lg:text-[3.6rem] leading-[1.05] tracking-[-.015em]">{{ title }}</h1>
    <p class="mt-5 mx-auto max-w-[34rem] text-quiet">{{ text }}</p>
    <p class="mt-9"><button type="button" class="btn btn-brand cursor-pointer" @click="$emit('act')">{{ action }}</button></p>
  </section>
</template>
