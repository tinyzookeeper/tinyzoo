<script setup lang="ts">
defineProps<{ block: BlockOf<'text'>; first?: boolean }>()
</script>

<template>
  <section class="wrap py-12 md:py-20">
    <component :is="first ? 'h1' : 'h2'" v-if="block.heading" class="text-[2.4rem] md:text-[3.6rem] leading-[1.06] mb-8 md:mb-10 max-w-[44rem]"><KitMarked :text="block.heading" plain /></component>
    <CmsContent v-if="block.body" :doc="block.body" class="prose-look" />
  </section>
</template>
