<script setup lang="ts">
// A page of plain text (the privacy page): the heading and the paragraphs in one calm column.
defineProps<{ block: BlockOf<'text'>; first?: boolean }>()
</script>

<template>
  <section class="wrap py-20 lg:py-28">
    <div class="max-w-[40rem]">
      <component :is="first ? 'h1' : 'h2'" v-if="block.heading" class="text-[2.1rem] md:text-[2.75rem] leading-[1.12] mb-8 lg:mb-10"><KitMarked :text="block.heading" /></component>
      <CmsContent v-if="block.body" :doc="block.body" class="prose-look" />
    </div>
    <slot />
  </section>
</template>
