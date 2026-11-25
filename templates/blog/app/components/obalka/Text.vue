<script setup lang="ts">
// A plain text page: a heading and rich text in the reading column.
const props = defineProps<{ block: BlockOf<'text'>; first?: boolean }>()
const tag = await useHeadingTag(() => props.first)
</script>

<template>
  <section class="wrap py-14 lg:py-20">
    <div class="max-w-[42rem]" :class="{ 'mx-auto': !$slots.default }">
      <component :is="tag" v-if="block.heading" class="mb-8 font-display text-[3rem] font-extralight leading-none tracking-[-0.025em] lg:mb-10 lg:text-[4.2rem]"><KitMarked :text="block.heading" /></component>
      <CmsContent v-if="block.body" :doc="block.body" class="prose-look" />
    </div>
    <slot />
  </section>
</template>
