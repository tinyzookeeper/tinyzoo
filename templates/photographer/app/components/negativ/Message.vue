<script setup lang="ts">
defineProps<{ code?: string; title: string; text: string; action: string }>()
defineEmits<{ act: [] }>()
</script>

<template>
  <section class="pad py-20 md:py-32">
    <p v-if="code" class="m text-brand mb-4">{{ code }}</p>
    <h1 class="d text-[15vw] md:text-[8vw] wide:text-[min(8vw,8rem)] max-w-[16ch]">{{ title }}</h1>
    <p class="mt-6 text-dim text-[1.2rem]">{{ text }}</p>
    <p class="mt-9"><button type="button" class="btn m !font-medium" @click="$emit('act')">{{ action }} <UIcon name="i-lucide-arrow-right" class="size-4" aria-hidden="true" /></button></p>
  </section>
</template>
