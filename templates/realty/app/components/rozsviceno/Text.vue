<script setup lang="ts">
defineProps<{ block: BlockOf<'text'>; first?: boolean }>()
</script>

<template>
  <section class="wrap py-16 md:py-28">
    <div class="max-w-[44rem]">
      <component :is="first ? 'h1' : 'h2'" v-if="block.heading" class="text-[2.3rem] md:text-[3.2rem] mb-8"><KitMarked :text="block.heading" as="span" :attrs="{ class: 'hand' }" /></component>
      <CmsContent v-if="block.body" :doc="block.body" class="prose-look" />
    </div>
  </section>
</template>
