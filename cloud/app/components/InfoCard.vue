<script setup lang="ts">
// A section: its name above (and something small on the right), its content in one card.
withDefaults(defineProps<{ title: string; padded?: boolean }>(), { padded: true })
</script>

<template>
  <section class="flex min-w-0 flex-col">
    <header class="mb-2 flex min-h-6 items-center gap-2">
      <h2 class="z-label">{{ title }}</h2>
      <div class="ml-auto text-sm text-muted"><slot name="aside" /></div>
    </header>
    <div class="z-card flex-1" :class="padded ? 'p-4 sm:p-5' : ''">
      <slot />
    </div>
  </section>
</template>
