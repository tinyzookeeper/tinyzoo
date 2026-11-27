<script setup lang="ts">
// A free page: a heading and rich text on the white ground (the privacy page, say).
defineProps<{ block: BlockOf<'text'>; first?: boolean }>()
</script>

<template>
  <section class="pb-20 md:pb-28" :class="first ? 'pt-[calc(80px+3.5rem)] md:pt-[calc(80px+5rem)]' : 'pt-16 md:pt-24'">
    <div class="wrap">
      <div class="max-w-[46rem]">
        <component :is="first ? 'h1' : 'h2'" v-if="block.heading" class="h2 mb-8"><KitMarked :text="block.heading" /></component>
        <CmsContent v-if="block.body" :doc="block.body" class="prose-look" />
      </div>
      <slot />
    </div>
  </section>
</template>
