<script setup lang="ts">
// Čtvero dob's archive of documents: every year as a card, on the second ground, with the
// section's heading in the same place as the other sections.
import type { Document } from '../../lib/cms-content'

defineProps<{ block: BlockOf<'documents'>; first?: boolean; anchor?: string; documents: Document[] }>()
</script>

<template>
  <section :id="anchor" class="scroll-mt-6 bg-sand" :class="first ? 'pb-20 pt-[calc(80px+5rem)] md:pb-24 md:pt-[calc(80px+6rem)]' : 'py-20 md:py-24'">
    <div class="wrap">
      <div class="grid gap-6 lg:grid-cols-12 lg:items-end">
        <component :is="first ? 'h1' : 'h2'" class="h2 lg:col-span-7"><KitMarked :text="block.heading" /></component>
        <p v-if="block.text" class="text-[1.1rem] lg:col-span-5">{{ tidy(block.text) }}</p>
      </div>
      <div class="mt-12"><CtveroDobDocumentCards :documents="documents" /></div>
    </div>
  </section>
</template>
