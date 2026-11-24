<script setup lang="ts">
// An empty place, explained: an animal, what the place is for, and the next step.
defineProps<{ title: string; description?: string; animal?: string }>()
</script>

<template>
  <div class="z-moment flex flex-col items-center px-6 py-14 text-center sm:py-20">
    <ZAnimal :name="animal ?? 'elephant'" class="mb-6 h-24 w-auto" />
    <h2 class="z-title text-xl text-highlighted sm:text-2xl">{{ title }}</h2>
    <p v-if="description" class="z-moment-text mt-2 max-w-md text-[0.9375rem] text-pretty">{{ description }}</p>
    <div v-if="$slots.default" class="mt-6 flex flex-wrap items-center justify-center gap-2">
      <slot />
    </div>
  </div>
</template>
