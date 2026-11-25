<script setup lang="ts">
defineProps<{ block: BlockOf<'text'>; first?: boolean }>()
</script>

<template>
  <section class="wrap py-16 md:py-24">
    <div class="max-w-[44rem] mx-auto">
      <component :is="first ? 'h1' : 'h2'" v-if="block.heading" class="lettering mb-8 text-[44px] md:text-[64px] leading-[1.02]">{{ tidyText(block.heading) }}</component>
      <CmsContent v-if="block.body" :doc="block.body" class="prose-look" />
    </div>
    <slot />
  </section>
</template>
