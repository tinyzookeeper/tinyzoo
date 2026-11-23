<script setup lang="ts">
// Ciferník's wide photograph: as wide as the page with the look's large rounded corners. (Its
// own page has none, but a site that changes look keeps the block.)
defineProps<{ block: BlockOf<'photo'>; first?: boolean }>()
</script>

<template>
  <div v-if="block.image" class="wrap pt-16 lg:pt-24">
    <CmsImage :media="block.image" sizes="(min-width: 1024px) 78rem, 100vw" class="w-full aspect-[4/3] sm:aspect-[2/1] lg:aspect-[21/9] object-cover rounded-[28px] lg:rounded-[40px]" />
  </div>
</template>
