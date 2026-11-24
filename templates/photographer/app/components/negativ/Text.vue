<script setup lang="ts">
defineProps<{ block: BlockOf<'text'>; first?: boolean }>()
</script>

<template>
  <section class="pad py-14 md:py-20">
    <component :is="first ? 'h1' : 'h2'" v-if="block.heading" class="d text-[13vw] md:text-[6vw] wide:text-[min(6vw,6rem)] max-w-[18ch] mb-8 md:mb-12"><KitMarked :text="block.heading" plain /></component>
    <CmsContent v-if="block.body" :doc="block.body" class="prose-look" />
  </section>
</template>
