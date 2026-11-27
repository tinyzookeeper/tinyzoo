<script setup lang="ts">
// A text page (the privacy page): a heavy heading, then the text.
defineProps<{ block: BlockOf<'text'>; first?: boolean }>()
</script>

<template>
  <section class="wrap pb-12 pt-16 lg:pb-20 lg:pt-24">
    <component :is="first ? 'h1' : 'h2'" v-if="block.heading" class="mb-8 text-[40px] font-extrabold leading-[.95] tracking-[-.04em] text-text sm:text-[64px] lg:mb-10"><KitMarked :text="block.heading" as="span" :attrs="{ class: 'text-brand' }" /></component>
    <CmsContent v-if="block.body" :doc="block.body" class="prose-look" />
    <slot />
  </section>
</template>
