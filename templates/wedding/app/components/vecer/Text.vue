<script setup lang="ts">
defineProps<{ block: BlockOf<'text'>; first?: boolean }>()
</script>

<template>
  <section class="wrap py-16 lg:py-24">
    <div class="max-w-[44rem]" :class="{ 'mx-auto': !$slots.default }">
      <component :is="first ? 'h1' : 'h2'" v-if="block.heading" class="h2 mb-8 lg:mb-10"><KitMarked :text="block.heading" /></component>
      <CmsContent v-if="block.body" :doc="block.body" class="prose-look" />
    </div>
    <slot />
  </section>
</template>
