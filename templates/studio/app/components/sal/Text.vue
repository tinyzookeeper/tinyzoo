<script setup lang="ts">
defineProps<{ block: BlockOf<'text'>; first?: boolean }>()
</script>

<template>
  <section class="wrap py-14 md:py-20">
    <div class="max-w-[44rem]">
      <component :is="first ? 'h1' : 'h2'" v-if="block.heading" class="h2 mb-8"><KitMarked :text="block.heading" /></component>
      <CmsContent v-if="block.body" :doc="block.body" class="prose-look" />
    </div>
    <slot />
  </section>
</template>
