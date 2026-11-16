<script setup lang="ts">
// Block "Opening" (hero): see cms.config.ts. Change the look freely.
// The props come from the generated client (app/lib/cms-content.ts, `pnpm cms:client`): rename
// or remove a field in cms.config.ts, regenerate, and this file stops type-checking until
// the template follows.
import type { Page } from '~/lib/cms-content'

defineProps<{ block: Extract<Page['sections'][number], { type: 'hero' }> }>()
</script>

<template>
  <section class="relative overflow-hidden bg-muted/40">
    <div class="mx-auto grid max-w-5xl items-center gap-8 px-4 py-16 md:grid-cols-2">
      <div>
        <h1 class="text-4xl font-bold leading-tight sm:text-5xl">{{ block.heading }}</h1>
        <p v-if="block.text" class="mt-4 text-lg text-muted whitespace-pre-line">{{ block.text }}</p>
        <UButton v-if="block.buttonLabel && block.buttonUrl" :to="siteHref(block.buttonUrl)" size="lg" class="mt-6">{{ block.buttonLabel }}</UButton>
      </div>
      <!-- from md up the picture fills half of a 64rem column (about 30rem), below that the screen -->
      <CmsImage v-if="block.image" :media="block.image" eager sizes="(min-width: 768px) 30rem, 100vw" class="aspect-[4/3] w-full rounded-xl object-cover" />
    </div>
  </section>
</template>
