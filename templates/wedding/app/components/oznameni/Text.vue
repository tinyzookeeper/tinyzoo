<script setup lang="ts">
defineProps<{ block: BlockOf<'text'>; first?: boolean }>()
</script>

<template>
  <section class="wrap py-14 lg:py-20">
    <div class="max-w-[42rem] mx-auto">
      <component :is="first ? 'h1' : 'h2'" v-if="block.heading" class="text-[2.6rem] lg:text-[3.4rem] leading-[1.08] mb-8 lg:mb-10 text-center"><KitMarked :text="block.heading" :attrs="{ class: 'font-serif italic text-[0.9em]' }" /></component>
      <CmsContent v-if="block.body" :doc="block.body" class="prose-look" />
    </div>
    <slot />
  </section>
</template>
