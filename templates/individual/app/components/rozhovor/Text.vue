<script setup lang="ts">
// A page of plain text (the privacy page): the heading in a bubble, the text in one column.
defineProps<{ block: BlockOf<'text'>; first?: boolean }>()
</script>

<template>
  <section class="wrap py-16 lg:py-24">
    <component :is="first ? 'h1' : 'h2'" v-if="block.heading" class="bubble bubble-q mb-8 lg:mb-10"><KitMarked :text="block.heading" plain /></component>
    <CmsContent v-if="block.body" :doc="block.body" class="prose-look" />
    <slot />
  </section>
</template>
