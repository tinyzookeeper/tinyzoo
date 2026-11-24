<script setup lang="ts">
// A text page: an optional heading and rich text.
defineProps<{ block: BlockOf<'text'>; first?: boolean }>()
</script>

<template>
  <section class="wrap pb-16 sm:pb-24" :class="first ? 'pt-36 sm:pt-44' : 'pt-16 sm:pt-24 border-t border-line'">
    <component :is="first ? 'h1' : 'h2'" v-if="block.heading" class="h2 mb-8 lg:mb-10"><KitMarked :text="block.heading" plain /></component>
    <CmsContent v-if="block.body" :doc="block.body" class="prose-look" />
  </section>
</template>
