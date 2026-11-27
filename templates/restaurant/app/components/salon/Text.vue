<script setup lang="ts">
// A page of plain text (the privacy page): a heading and paragraphs on the dark page.
defineProps<{ block: BlockOf<'text'>; first?: boolean }>()
</script>

<template>
  <section class="wrap py-16 lg:py-24">
    <div class="max-w-[44rem]" :class="{ 'mx-auto': !$slots.default }">
      <component :is="first ? 'h1' : 'h2'" v-if="block.heading" class="font-display font-medium text-[2.4rem] lg:text-[3.3rem] leading-[1.08] tracking-[-.01em] mb-8 lg:mb-10"><KitMarked :text="block.heading" /></component>
      <CmsContent v-if="block.body" :doc="block.body" class="prose-look" />
    </div>
    <slot />
  </section>
</template>
