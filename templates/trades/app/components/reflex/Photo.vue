<script setup lang="ts">
// Reflex's photograph across the page: edge to edge under the phone slab, its caption on a black
// label in the corner.
defineProps<{ block: BlockOf<'photo'>; first?: boolean }>()
</script>

<template>
  <figure v-if="block.image" class="relative">
    <div class="ph aspect-[4/3] sm:aspect-[2/1] lg:aspect-[21/9]"><CmsImage :media="block.image" eager sizes="100vw" /></div>
    <figcaption v-if="block.caption" class="absolute left-0 bottom-0 bg-ink text-white label !text-[0.9375rem] px-5 md:px-10 py-2.5">{{ block.caption }}</figcaption>
  </figure>
</template>
