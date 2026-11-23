<script setup lang="ts">
defineProps<{ block: BlockOf<'text'>; first?: boolean }>()
</script>

<template>
  <section class="wrap pt-10 lg:pt-14 pb-16 lg:pb-24">
    <component :is="first ? 'h1' : 'h2'" v-if="block.heading" class="text-[2.5rem] sm:text-[3.2rem] lg:text-[3.6rem] mb-8 lg:mb-10"><KitMarked :text="block.heading" plain /></component>
    <div v-if="block.body" class="panel p-6 sm:p-9 lg:p-12"><CmsContent :doc="block.body" class="prose-look" /></div>
  </section>
</template>
