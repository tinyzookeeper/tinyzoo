<script setup lang="ts">
// A wide photograph between two sections, as large as the page.
defineProps<{ block: BlockOf<'photo'>; first?: boolean }>()
</script>

<template>
  <div v-if="block.image" class="wrap pt-20 lg:pt-28">
    <CmsImage :media="block.image" sizes="(min-width: 1024px) 72rem, 100vw" class="photo w-full aspect-[4/3] sm:aspect-[2/1] lg:aspect-[21/9]" />
  </div>
</template>
