<script setup lang="ts">
// Magazín's contacts: the heading on the left, the people as columns under strong rules, the phone set large.
import type { Contact } from '../../lib/cms-content'

defineProps<{ block: BlockOf<'contacts'>; first?: boolean; anchor?: string; items: Contact[] }>()
</script>

<template>
  <section :id="anchor" class="wrap pb-24 lg:pb-36">
    <div class="grid lg:grid-cols-12 gap-x-10 gap-y-10 items-start">
      <div class="lg:col-span-5">
        <p v-if="block.eyebrow" class="label text-brand">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="h2 mt-5"><KitMarked :text="block.heading" /></component>
        <p v-if="block.text" class="mt-6 max-w-[28rem]">{{ tidyText(block.text) }}</p>
      </div>
      <div v-if="items.length" class="lg:col-span-6 lg:col-start-7 grid sm:grid-cols-2 gap-x-10 sm:gap-y-10">
        <div v-for="(c, i) in items" :key="c.id" class="border-t border-ink pt-6" :class="i < items.length - 1 ? 'pb-9 sm:pb-0' : ''">
          <p v-if="c.role" class="label text-quiet">{{ c.role }}</p>
          <p class="serif text-ink text-[1.9rem] leading-tight mt-3">{{ c.name }}</p>
          <p v-if="c.note" class="mt-1">{{ tidyText(c.note) }}</p>
          <a v-if="c.phone" class="tlink serif text-[1.9rem] mt-3" :href="telHref(c.phone)">{{ c.phone }}</a>
        </div>
      </div>
    </div>
  </section>
</template>
