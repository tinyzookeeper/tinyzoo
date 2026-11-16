<script setup lang="ts">
// Block "Opening" (hero): see cms.config.ts. Change the look freely.
defineProps<{ block: { heading: string; text?: string | null; image?: any; buttonLabel?: string | null; buttonUrl?: string | null } }>()
</script>

<template>
  <section class="relative overflow-hidden bg-muted/40">
    <div class="mx-auto grid max-w-5xl items-center gap-8 px-4 py-16 md:grid-cols-2">
      <div>
        <h1 class="text-4xl font-bold leading-tight sm:text-5xl">{{ block.heading }}</h1>
        <p v-if="block.text" class="mt-4 text-lg text-muted whitespace-pre-line">{{ block.text }}</p>
        <UButton v-if="block.buttonLabel && block.buttonUrl" :to="block.buttonUrl" size="lg" class="mt-6">{{ block.buttonLabel }}</UButton>
      </div>
      <CmsImage v-if="block.image" :media="block.image" eager class="aspect-[4/3] w-full rounded-xl object-cover" />
    </div>
  </section>
</template>
