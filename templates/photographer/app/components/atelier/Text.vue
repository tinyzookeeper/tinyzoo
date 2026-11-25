<script setup lang="ts">
defineProps<{ block: BlockOf<'text'>; first?: boolean }>()
</script>

<template>
  <section class="wrap py-14 md:py-20">
    <component :is="first ? 'h1' : 'h2'" v-if="block.heading" class="text-[2.4rem] md:text-[3.4rem] leading-[1.04] mb-8 md:mb-10 max-w-[44rem]"><KitMarked :text="block.heading" /></component>
    <CmsContent v-if="block.body" :doc="block.body" class="prose-look" />
    <slot />
  </section>
</template>
