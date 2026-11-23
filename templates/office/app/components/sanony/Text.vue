<script setup lang="ts">
// Šanony's free text: a heavy heading over paragraphs.
defineProps<{ block: BlockOf<'text'>; first?: boolean }>()
</script>

<template>
  <section class="wrap py-16 lg:py-28">
    <component :is="first ? 'h1' : 'h2'" v-if="block.heading" class="display mb-8 text-[42px] sm:text-[64px] lg:mb-12 xl:text-[76px]"><KitMarked :text="block.heading" plain /></component>
    <CmsContent v-if="block.body" :doc="block.body" class="prose-look" />
  </section>
</template>
