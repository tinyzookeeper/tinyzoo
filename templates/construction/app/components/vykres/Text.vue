<script setup lang="ts">
// A text page (the privacy page): a heading over a heavy rule, then the text.
defineProps<{ block: BlockOf<'text'>; first?: boolean }>()
</script>

<template>
  <section class="wrap pb-12 pt-20 lg:pb-20 lg:pt-28">
    <div class="border-b-2 border-ink pb-5">
      <component :is="first ? 'h1' : 'h2'" v-if="block.heading" class="font-display text-[32px] font-light leading-tight tracking-[-.02em] text-ink sm:text-[42px]"><KitMarked :text="block.heading" as="span" /></component>
    </div>
    <CmsContent v-if="block.body" :doc="block.body" class="prose-look mt-8" />
    <slot />
  </section>
</template>
