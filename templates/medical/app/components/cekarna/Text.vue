<script setup lang="ts">
defineProps<{ block: BlockOf<'text'>; first?: boolean }>()
</script>

<template>
  <section class="wrap pt-10 lg:pt-16 pb-16 lg:pb-24">
    <component :is="first ? 'h1' : 'h2'" v-if="block.heading" class="text-[2.5rem] sm:text-[3rem] lg:text-[3.5rem] mb-8 lg:mb-10"><KitMarked :text="block.heading" plain /></component>
    <CmsContent v-if="block.body" :doc="block.body" class="prose-look" />
    <slot />
  </section>
</template>
