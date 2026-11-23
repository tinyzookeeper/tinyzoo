<script setup lang="ts">
defineProps<{ block: BlockOf<'text'>; first?: boolean }>()
</script>

<template>
  <section class="wrap py-16 md:py-24">
    <div class="max-w-[44rem]">
      <component :is="first ? 'h1' : 'h2'" v-if="block.heading" class="mb-8 text-[2.3rem] md:mb-10 md:text-[3.3rem]"><KitMarked :text="block.heading" /></component>
      <CmsContent v-if="block.body" :doc="block.body" class="prose-look" />
    </div>
  </section>
</template>
