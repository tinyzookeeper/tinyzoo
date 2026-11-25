<script setup lang="ts">
// A page of plain text (the privacy page): a poster heading and paragraphs.
defineProps<{ block: BlockOf<'text'>; first?: boolean }>()
</script>

<template>
  <section class="wrap py-16 lg:py-24">
    <div class="max-w-[44rem]">
      <component :is="first ? 'h1' : 'h2'" v-if="block.heading" class="wide text-[2.5rem] lg:text-[4.4rem] mb-8 lg:mb-10"><KitMarked :text="block.heading" plain /></component>
      <CmsContent v-if="block.body" :doc="block.body" class="prose-look" />
    </div>
    <slot />
  </section>
</template>
