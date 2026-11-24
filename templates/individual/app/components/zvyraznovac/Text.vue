<script setup lang="ts">
// A page of plain text (the privacy page): the heading in the heavy type, the text in one column.
defineProps<{ block: BlockOf<'text'>; first?: boolean }>()
</script>

<template>
  <section class="wrap pt-16 lg:pt-24 pb-20 lg:pb-28">
    <component :is="first ? 'h1' : 'h2'" v-if="block.heading" class="text-[2.9rem] md:text-[4.5rem] lg:text-[5.6rem] tracking-[-0.05em] mb-10 lg:mb-14"><KitMarked :text="block.heading" /></component>
    <CmsContent v-if="block.body" :doc="block.body" class="prose-look" />
  </section>
</template>
