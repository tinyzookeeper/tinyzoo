<script setup lang="ts">
// The pilot feedback form (defineForm 'feedback' in cms.config.ts), with a heading.
defineProps<{ block: { heading?: string | null; text?: string | null } }>()
const { lang } = useLang()
</script>

<template>
  <section class="section">
    <div class="wrap grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
      <div>
        <h2 v-if="block.heading" class="title text-4xl sm:text-5xl">{{ block.heading }}</h2>
        <p v-if="block.text" class="lede mt-5 whitespace-pre-line">{{ block.text }}</p>
        <img src="/animals/bird.svg" alt="" class="mt-10 hidden h-20 w-auto lg:block" aria-hidden="true">
      </div>
      <div class="feedback rounded-[1.75rem] bg-cream p-6 sm:p-10">
        <CmsForm name="feedback" :locale="lang" />
      </div>
    </div>
  </section>
</template>
