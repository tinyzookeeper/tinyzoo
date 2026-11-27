<script setup lang="ts">
// A page of plain text (the privacy page, say): a heading that leans forward and the editor's rich text, in a column.
defineProps<{ block: BlockOf<'text'>; first?: boolean }>()
</script>

<template>
  <section class="wrap py-16 lg:py-24">
    <component :is="first ? 'h1' : 'h2'" v-if="block.heading" class="disp h2 mb-8"><span class="slash" aria-hidden="true" /><KitMarked :text="block.heading" plain /></component>
    <CmsContent v-if="block.body" :doc="block.body" class="prose-look" />
    <slot />
  </section>
</template>
