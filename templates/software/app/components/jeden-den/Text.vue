<script setup lang="ts">
defineProps<{ block: BlockOf<'text'>; first?: boolean }>()
</script>

<template>
  <section class="bg-noon">
    <div class="wrap py-16 lg:py-24">
      <div class="max-w-[44rem]">
        <component :is="first ? 'h1' : 'h2'" v-if="block.heading" class="h2 mb-8 text-[36px] sm:text-[46px] lg:mb-10 lg:text-[52px]"><KitMarked :text="block.heading" /></component>
        <CmsContent v-if="block.body" :doc="block.body" class="prose-look" />
      </div>
      <slot />
    </div>
  </section>
</template>
