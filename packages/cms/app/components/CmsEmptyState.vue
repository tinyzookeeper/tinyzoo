<script setup lang="ts">
// One empty state for the whole admin: first use ("nothing here yet"), no results,
// and errors. Explains what the place is for and offers the next step. A first-use
// state shows one of tinyzoo's animals — the same one for the same place
// (`character` seeds the choice); no results and errors stay plain.
const props = withDefaults(defineProps<{
  icon?: string
  title: string
  description?: string
  variant?: 'first-use' | 'no-results' | 'error'
  character?: string
  /** No animal: an empty state inside a form, or one that is not about missing content. */
  plain?: boolean
}>(), { icon: 'i-lucide-inbox', variant: 'first-use' })

const animal = computed(() => (props.variant === 'first-use' && !props.plain ? cmsCharacterFor(props.character ?? props.title) : null))
</script>

<template>
  <div class="flex flex-col items-center text-center px-6 py-14 sm:py-16" :role="variant === 'error' ? 'alert' : undefined">
    <img v-if="animal" :src="animal.url" alt="" class="h-14 w-auto mb-5 select-none" draggable="false" :data-character="animal.name">
    <div
      v-else
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
