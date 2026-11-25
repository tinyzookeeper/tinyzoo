<script setup lang="ts">
defineProps<{ block: BlockOf<'text'>; first?: boolean }>()
</script>

<template>
  <section class="wrap py-16 md:py-24">
    <div class="max-w-[44rem]" :class="{ 'mx-auto': !$slots.default }">
      <component :is="first ? 'h1' : 'h2'" v-if="block.heading" class="mb-8 text-[38px] md:text-[48px] leading-[1.08]">{{ tidyText(block.heading) }}</component>
      <CmsContent v-if="block.body" :doc="block.body" class="prose-look" />
    </div>
    <slot />
  </section>
</template>
