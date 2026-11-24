<script setup lang="ts">
// A page of plain text (the privacy page, say): a heading and rich text in a column.
defineProps<{ block: BlockOf<'text'>; first?: boolean }>()
</script>

<template>
  <section class="wrap pt-14 md:pt-20 pb-20 md:pb-28">
    <component :is="first ? 'h1' : 'h2'" v-if="block.heading" class="h2 mb-8 lg:mb-10 !text-[clamp(2.6rem,6vw,5rem)]"><KitMarked :text="block.heading" plain /></component>
    <CmsContent v-if="block.body" :doc="block.body" class="prose-look" />
  </section>
</template>
