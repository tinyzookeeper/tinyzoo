<script setup lang="ts">
// A heading and paragraphs from the rich text editor.
defineProps<{ block: { heading?: string | null; body?: any } }>()
</script>

<template>
  <section class="section !pt-6">
    <div class="wrap max-w-3xl">
      <h2 v-if="block.heading" class="title text-3xl sm:text-4xl">{{ block.heading }}</h2>
      <CmsContent v-if="block.body" :doc="block.body" class="prose-zoo mt-6" />
    </div>
  </section>
</template>
