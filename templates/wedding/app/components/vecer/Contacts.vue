<script setup lang="ts">
// Večer's contacts: centred columns divided by a hairline, the phone set large.
import type { Contact } from '../../lib/cms-content'

defineProps<{ block: BlockOf<'contacts'>; first?: boolean; anchor?: string; items: Contact[] }>()
</script>

<template>
  <section :id="anchor" class="wrap pb-24 lg:pb-36 text-center">
    <p v-if="block.eyebrow" class="label text-brand">{{ block.eyebrow }}</p>
    <component :is="first ? 'h1' : 'h2'" class="h2 mt-5"><KitMarked :text="block.heading" /></component>
    <p v-if="block.text" class="mt-5 max-w-[34rem] mx-auto">{{ tidyText(block.text) }}</p>
    <div v-if="items.length" class="grid max-w-[54rem] mx-auto mt-12 sm:gap-y-10" :class="items.length > 1 ? 'sm:grid-cols-2' : ''">
      <div v-for="(c, i) in items" :key="c.id" class="py-8 sm:py-4 sm:px-8 max-sm:border-t border-line" :class="[i % 2 ? 'sm:border-l' : '', i === items.length - 1 ? 'max-sm:pb-0' : '']">
        <p v-if="c.role" class="label text-quiet">{{ c.role }}</p>
        <p class="text-ink text-[1.85rem] leading-tight mt-3">{{ c.name }}</p>
        <p v-if="c.note" class="italic mt-1">{{ tidyText(c.note) }}</p>
        <a v-if="c.phone" class="tlink font-light text-[1.9rem] mt-2" :href="telHref(c.phone)">{{ c.phone }}</a>
      </div>
    </div>
  </section>
</template>
