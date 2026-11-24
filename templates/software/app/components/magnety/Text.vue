<script setup lang="ts">
defineProps<{ block: BlockOf<'text'>; first?: boolean }>()
</script>

<template>
  <section class="wrap py-14 lg:py-24">
    <div class="max-w-[44rem]">
      <component :is="first ? 'h1' : 'h2'" v-if="block.heading" class="q mb-8 text-[40px] sm:text-[52px] lg:mb-10 lg:text-[64px]"><KitMarked :text="block.heading" /></component>
      <CmsContent v-if="block.body" :doc="block.body" class="prose-look" />
    </div>
  </section>
</template>
