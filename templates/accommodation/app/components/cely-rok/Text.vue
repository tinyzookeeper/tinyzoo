<script setup lang="ts">
// A page of text (a document, a few paragraphs).
defineProps<{ block: BlockOf<'text'>; first?: boolean }>()
</script>

<template>
  <section class="wrap pt-12 pb-20 md:pt-16 md:pb-28">
    <div class="max-w-[44rem]">
      <component :is="first ? 'h1' : 'h2'" v-if="block.heading" class="h2 mb-8 lg:mb-10"><KitMarked :text="block.heading" plain /></component>
      <CmsContent v-if="block.body" :doc="block.body" class="prose-look" />
    </div>
    <slot />
  </section>
</template>
