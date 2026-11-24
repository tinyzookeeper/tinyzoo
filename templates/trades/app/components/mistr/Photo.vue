<script setup lang="ts">
// Mistr's photograph across the page: in the page's column, in a plain frame, the caption under it.
defineProps<{ block: BlockOf<'photo'>; first?: boolean }>()
</script>

<template>
  <figure v-if="block.image" class="wrap pt-12 md:pt-16">
    <div class="ph aspect-[4/3] sm:aspect-[2/1] lg:aspect-[21/9]"><CmsImage :media="block.image" sizes="(min-width: 1280px) 76rem, 100vw" /></div>
    <figcaption v-if="block.caption" class="cap">{{ block.caption }}</figcaption>
  </figure>
</template>
