<script setup lang="ts">
// An empty place, explained: an animal (first use) or a quiet icon (no results), what the
// place is for, and the next step.
withDefaults(defineProps<{ title: string; description?: string; animal?: string; icon?: string }>(), { icon: 'i-lucide-search-x' })
</script>

<template>
  <div class="flex flex-col items-center px-6 py-14 text-center sm:py-16">
    <KAnimal v-if="animal" :name="animal" class="mb-5 h-20 w-auto" />
    <div v-else class="mb-4 flex size-10 items-center justify-center rounded-md border border-default text-muted">
      <UIcon :name="icon" class="size-5" />
    </div>
    <h3 :class="animal ? 'k-display text-lg text-highlighted' : 'text-sm font-semibold text-highlighted'">{{ title }}</h3>
    <p v-if="description" class="mt-1 max-w-sm text-sm text-pretty text-muted">{{ description }}</p>
    <div v-if="$slots.default" class="mt-5 flex flex-wrap items-center justify-center gap-2">
      <slot />
    </div>
  </div>
</template>
