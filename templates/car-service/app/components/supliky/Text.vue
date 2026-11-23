<script setup lang="ts">
// A free page's text: a heading and paragraphs, headings and lists in a column.
defineProps<{ block: BlockOf<'text'>; first?: boolean }>()
</script>

<template>
  <section class="wrap py-16 lg:py-24">
    <div class="max-w-[44rem]">
      <component :is="first ? 'h1' : 'h2'" v-if="block.heading" class="text-[42px] sm:text-[60px] mb-8 lg:mb-10">{{ plainEmphasis(block.heading) }}</component>
      <CmsContent v-if="block.body" :doc="block.body" class="prose-look" />
    </div>
  </section>
</template>
