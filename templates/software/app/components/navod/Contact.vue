<script setup lang="ts">
// Návod's contact block: only the contact area, on a page of its own.
import type { SiteForm } from '#imports'

defineProps<{ block: BlockOf<'contact'>; first?: boolean; anchor?: string; form: SiteForm }>()
</script>

<template>
  <section>
    <div class="wrap py-16 lg:py-24">
      <NavodContactForm :anchor="anchor" :form="form" :heading="block.heading" :text="block.text" :note="block.note" :first="first" bare />
    </div>
  </section>
</template>
