<script setup lang="ts">
// Šanony's wide photograph: full width, with the caption on an ink bar over its lower left corner
// (under the photograph on a phone).
defineProps<{ block: BlockOf<'photo'> }>()
</script>

<template>
  <figure v-if="block.image" class="relative mt-12 xl:mt-0">
    <CmsImage :media="block.image" sizes="100vw" class="aspect-[4/3] w-full object-cover sm:aspect-[21/9]" />
    <figcaption v-if="block.caption" class="bg-ink text-paper sm:absolute sm:bottom-0 sm:left-0 sm:max-w-[560px]">
      <p class="px-5 py-4 text-[15px] font-semibold leading-snug sm:px-8 sm:py-5">{{ tidyText(block.caption) }}</p>
    </figcaption>
  </figure>
</template>
