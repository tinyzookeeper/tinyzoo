<script setup lang="ts">
// Block "Text": rich text written in the admin. Typed from the generated client (see BlockHero.vue).
import type { Page } from '~/lib/cms-content'

defineProps<{ block: Extract<Page['sections'][number], { type: 'text' }> }>()
</script>

<template>
  <section class="mx-auto max-w-5xl px-4 py-10">
    <CmsContent :doc="block.body" class="prose max-w-3xl" />
  </section>
</template>
