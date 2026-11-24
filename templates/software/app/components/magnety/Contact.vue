<script setup lang="ts">
// Magnets' contact block: only the form tile, on a page of its own.
import type { SiteForm } from '#imports'

defineProps<{ block: BlockOf<'contact'>; first?: boolean; anchor?: string; form: SiteForm }>()
</script>

<template>
  <section class="wrap py-14 lg:py-24">
    <MagnetyContactForm :anchor="anchor" :form="form" :heading="block.heading" :eyebrow="block.eyebrow" :text="block.text" :first="first" class="max-w-[60rem]" />
  </section>
</template>
