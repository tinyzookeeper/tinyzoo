<script setup lang="ts">
// Lhůty's wide photograph: across the page's width, a small line of mono type under it.
defineProps<{ block: BlockOf<'photo'> }>()
</script>

<template>
  <figure v-if="block.image" class="wrap py-12 lg:py-16">
    <CmsImage :media="block.image" sizes="(min-width: 1280px) 78rem, 100vw" class="aspect-[16/9] w-full object-cover sm:aspect-[21/9]" />
    <figcaption v-if="block.caption" class="mt-3 font-mono text-[12px] text-quiet">{{ tidyText(block.caption) }}</figcaption>
  </figure>
</template>
