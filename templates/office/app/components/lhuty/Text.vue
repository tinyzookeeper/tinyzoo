<script setup lang="ts">
// Lhůty's free text: a heading and paragraphs on the page's width.
defineProps<{ block: BlockOf<'text'>; first?: boolean }>()
</script>

<template>
  <section class="wrap py-16 lg:py-24">
    <component :is="first ? 'h1' : 'h2'" v-if="block.heading" class="mb-8 font-display text-[32px] leading-[1.15] sm:text-[42px] lg:mb-10"><KitMarked :text="block.heading" /></component>
    <CmsContent v-if="block.body" :doc="block.body" class="prose-look" />
  </section>
</template>
