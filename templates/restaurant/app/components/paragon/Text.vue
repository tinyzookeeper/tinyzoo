<script setup lang="ts">
// A page of plain text (the privacy page): a typed sheet with its heading printed in ink.
defineProps<{ block: BlockOf<'text'>; first?: boolean }>()
</script>

<template>
  <section class="wrap py-12 lg:py-20">
    <div class="sheet max-w-[48rem] mx-auto px-5 pt-9 pb-9 sm:px-10 sm:pt-12 sm:pb-12">
      <component :is="first ? 'h1' : 'h2'" v-if="block.heading" class="h text-[2.2rem] sm:text-[3rem] pb-4 border-b-[3px] border-double border-ink mb-7"><KitMarked :text="block.heading" plain /></component>
      <CmsContent v-if="block.body" :doc="block.body" class="prose-look" />
    </div>
    <slot />
  </section>
</template>
