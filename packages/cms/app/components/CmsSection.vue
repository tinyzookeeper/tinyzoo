<script setup lang="ts">
// A titled card on the page background — the unit that groups related fields or
// lists. One frame per group; sections are never nested.
defineProps<{ title?: string; description?: string; flush?: boolean }>()
</script>

<template>
  <section class="cms-card overflow-hidden">
    <header v-if="title || $slots.actions" class="flex items-start justify-between gap-4 px-5 pt-4" :class="flush ? 'pb-3 border-b border-default' : ''">
      <div class="min-w-0">
        <h2 v-if="title" class="text-sm font-semibold text-highlighted">{{ title }}</h2>
        <p v-if="description" class="mt-0.5 text-sm text-muted">{{ description }}</p>
      </div>
      <slot name="actions" />
    </header>
    <div :class="flush ? '' : 'p-5'">
      <slot />
    </div>
  </section>
</template>
