<script setup lang="ts">
// A page of plain text (the privacy page, say): a wide headline and the editor's rich text, in a column.
defineProps<{ block: BlockOf<'text'>; first?: boolean }>()
</script>

<template>
  <section class="wrap py-16 lg:py-24">
    <component :is="first ? 'h1' : 'h2'" v-if="block.heading" class="wide mb-8 text-[clamp(30px,6vw,84px)]">{{ plainEmphasis(block.heading) }}</component>
    <CmsContent v-if="block.body" :doc="block.body" class="prose-look" />
  </section>
</template>
