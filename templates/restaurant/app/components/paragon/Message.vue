<script setup lang="ts">
// A short message in place of a page: an address that leads nowhere, an error. A sheet with a stamp.
defineProps<{ code?: string; title: string; text: string; action: string }>()
defineEmits<{ act: [] }>()
</script>

<template>
  <section class="wrap py-20 lg:py-28">
    <div class="sheet max-w-[40rem] mx-auto px-6 pt-10 pb-9 sm:px-10">
      <p v-if="code" class="stamp">{{ code }}</p>
      <h1 class="h mt-6 text-[2.5rem] sm:text-[3.4rem]">{{ title }}</h1>
      <p class="mt-5">{{ text }}</p>
      <p class="mt-8"><button type="button" class="btn cursor-pointer" @click="$emit('act')">{{ action }}</button></p>
    </div>
  </section>
</template>
