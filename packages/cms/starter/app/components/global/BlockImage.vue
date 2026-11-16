<script setup lang="ts">
// Block "Picture": one picture with a caption. Typed from the generated client (see BlockHero.vue).
import type { Page } from '~/lib/cms-content'

defineProps<{ block: Extract<Page['sections'][number], { type: 'image' }> }>()
</script>

<template>
  <figure v-if="block.image" class="mx-auto max-w-5xl px-4 py-8">
    <CmsImage :media="block.image" sizes="(min-width: 1024px) 62rem, 100vw" class="w-full rounded-xl" />
    <figcaption v-if="block.caption" class="mt-2 text-sm text-muted text-center">{{ block.caption }}</figcaption>
  </figure>
</template>
