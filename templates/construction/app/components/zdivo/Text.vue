<script setup lang="ts">
// A text page (the privacy page): a heading in the blocky slab, then the text on a card.
defineProps<{ block: BlockOf<'text'>; first?: boolean }>()
</script>

<template>
  <section class="wrap pb-12 pt-10 lg:pb-20 lg:pt-14">
    <component :is="first ? 'h1' : 'h2'" v-if="block.heading" class="h2 mb-8 lg:mb-10"><KitMarked :text="block.heading" as="span" /></component>
    <div v-if="block.body" class="rounded-[4px] bg-card p-6 sm:p-9"><CmsContent :doc="block.body" class="prose-look" /></div>
  </section>
</template>
