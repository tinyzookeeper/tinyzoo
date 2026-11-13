<script setup lang="ts">
// One empty state for the whole admin: first use ("nothing here yet"), no results,
// and errors. Explains what the place is for and offers the next step.
withDefaults(defineProps<{
  icon?: string
  title: string
  description?: string
  variant?: 'first-use' | 'no-results' | 'error'
}>(), { icon: 'i-lucide-inbox', variant: 'first-use' })
</script>

<template>
  <div class="flex flex-col items-center text-center px-6 py-14 sm:py-16" :role="variant === 'error' ? 'alert' : undefined">
    <div
      class="size-10 rounded-md flex items-center justify-center mb-4"
      :class="variant === 'error' ? 'bg-error/10 text-error' : 'border border-default text-muted'"
    >
      <UIcon :name="variant === 'error' ? 'i-lucide-triangle-alert' : variant === 'no-results' ? 'i-lucide-search-x' : icon" class="size-5" />
    </div>
    <h3 class="text-sm font-semibold text-highlighted">{{ title }}</h3>
    <p v-if="description" class="mt-1 text-sm text-muted max-w-sm text-pretty">{{ description }}</p>
    <div v-if="$slots.actions" class="mt-5 flex items-center gap-2">
      <slot name="actions" />
    </div>
  </div>
</template>
