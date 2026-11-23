<script setup lang="ts">
// Oznámení's contacts: centred name cards side by side, the phone set large.
import type { Contact } from '~/lib/cms-content'

defineProps<{ block: BlockOf<'contacts'>; first?: boolean; anchor?: string; items: Contact[] }>()
</script>

<template>
  <section :id="anchor" class="wrap py-20 lg:py-28 text-center">
    <p v-if="block.eyebrow" class="label text-brand">{{ block.eyebrow }}</p>
    <component :is="first ? 'h1' : 'h2'" class="text-[2.6rem] lg:text-[3.4rem] leading-[1.08] mt-4"><KitMarked :text="block.heading" plain /></component>
    <p v-if="block.text" class="mt-4 max-w-[34rem] mx-auto">{{ tidyText(block.text) }}</p>
    <div v-if="items.length" class="grid max-w-[52rem] mx-auto mt-12" :class="items.length > 1 ? 'sm:grid-cols-2' : ''">
      <div v-for="(c, i) in items" :key="c.id" class="py-9 sm:px-8 border-t border-line" :class="[i >= items.length - 2 || items.length === 1 ? 'sm:border-b' : '', i === items.length - 1 ? 'border-b' : '', i % 2 ? 'sm:border-l' : '']">
        <p v-if="c.role" class="label text-quiet">{{ c.role }}</p>
        <p class="font-display text-ink text-[2rem] leading-tight mt-3">{{ c.name }}</p>
        <p v-if="c.note" class="italic mt-1">{{ tidyText(c.note) }}</p>
        <a v-if="c.phone" class="tlink font-display text-[1.7rem] mt-3" :href="telHref(c.phone)">{{ c.phone }}</a>
      </div>
    </div>
  </section>
</template>
