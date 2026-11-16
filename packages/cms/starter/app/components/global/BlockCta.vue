<script setup lang="ts">
// Block "Call to action": a heading and one button. Typed from the generated client (see BlockHero.vue).
import type { Page } from '~/lib/cms-content'

defineProps<{ block: Extract<Page['sections'][number], { type: 'cta' }> }>()
</script>

<template>
  <section class="mx-auto max-w-5xl px-4 py-12">
    <div class="flex flex-col items-start gap-4 rounded-2xl bg-inverted px-8 py-10 text-inverted sm:flex-row sm:items-center sm:justify-between">
      <h2 class="text-2xl font-semibold">{{ block.heading }}</h2>
      <UButton v-if="block.buttonUrl" :to="siteHref(block.buttonUrl)" color="neutral" variant="solid" size="lg" class="bg-default text-highlighted hover:bg-default/90">{{ block.buttonLabel }}</UButton>
    </div>
  </section>
</template>
