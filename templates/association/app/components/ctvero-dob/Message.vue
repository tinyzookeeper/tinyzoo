<script setup lang="ts">
// A short message in place of a page: an address that leads nowhere, an error. It sits on the
// quiet ground under the header, like the opening.
defineProps<{ code?: string; title: string; text: string; action: string }>()
defineEmits<{ act: [] }>()
</script>

<template>
  <section class="bg-sand pt-[80px]">
    <div class="wrap py-20 text-center md:py-28">
      <p v-if="code" class="chip">{{ code }}</p>
      <h1 class="h2 mt-6">{{ title }}</h1>
      <p class="mx-auto mt-5 max-w-[30rem] text-[1.1rem]">{{ text }}</p>
      <p class="mt-9"><button type="button" class="btn" @click="$emit('act')">{{ action }}</button></p>
    </div>
  </section>
</template>
