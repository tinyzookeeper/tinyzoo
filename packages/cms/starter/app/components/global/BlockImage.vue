<script setup lang="ts">
// Block "Picture": one picture with a caption.
defineProps<{ block: { image?: any; caption?: string | null } }>()
</script>

<template>
  <figure v-if="block.image" class="mx-auto max-w-5xl px-4 py-8">
    <CmsImage :media="block.image" class="w-full rounded-xl" />
    <figcaption v-if="block.caption" class="mt-2 text-sm text-muted text-center">{{ block.caption }}</figcaption>
  </figure>
</template>
