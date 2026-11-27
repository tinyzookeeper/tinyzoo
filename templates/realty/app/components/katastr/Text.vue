<script setup lang="ts">
defineProps<{ block: BlockOf<'text'>; first?: boolean }>()
</script>

<template>
  <section class="wrap py-16 md:py-24">
    <div class="max-w-[44rem]">
      <component :is="first ? 'h1' : 'h2'" v-if="block.heading" class="text-[2.1rem] md:text-[2.75rem] leading-[1.1] mb-8"><KitMarked :text="block.heading" /></component>
      <CmsContent v-if="block.body" :doc="block.body" class="prose-look" />
    </div>
    <slot />
  </section>
</template>
