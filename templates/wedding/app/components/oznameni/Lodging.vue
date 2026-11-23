<script setup lang="ts">
// Oznámení's places to stay: a ruled table, the name with its note, the distance, the price, the link.
import type { Lodging } from '~/lib/cms-content'

defineProps<{ block: BlockOf<'lodging'>; first?: boolean; anchor?: string; items: Lodging[] }>()
</script>

<template>
  <section :id="anchor" class="wrap pb-24 lg:pb-32">
    <div class="grid lg:grid-cols-12 gap-x-12 gap-y-8 items-start">
      <div class="lg:col-span-4">
        <component :is="first ? 'h1' : 'h2'" class="text-[2rem] lg:text-[2.3rem] leading-[1.1]"><KitMarked :text="block.heading" :attrs="{ class: 'font-serif italic text-[0.9em]' }" /></component>
        <p v-if="block.text" class="mt-4">{{ tidyText(block.text) }}</p>
      </div>
      <ul v-if="items.length" class="lg:col-span-8 border-b border-line">
        <li v-for="item in items" :key="item.id" class="grid grid-cols-2 sm:grid-cols-[1fr_6rem_9.5rem_9rem] items-baseline gap-x-6 gap-y-1 py-5 border-t border-line">
          <div class="col-span-2 sm:col-span-1">
            <p class="font-display text-ink text-[1.45rem] leading-tight">{{ tidyText(item.name) }}</p>
            <p v-if="item.description" class="text-[0.95rem] italic">{{ tidyText(item.description) }}</p>
          </div>
          <p class="label text-quiet">{{ item.distance }}</p>
          <p class="text-ink text-right sm:text-left">{{ tidyText(priceParts(item.price)[0]) }} <span v-if="priceParts(item.price)[1]" class="text-quiet text-[0.9rem]">{{ priceParts(item.price)[1] }}</span></p>
          <p class="col-span-2 sm:col-span-1 justify-self-start sm:justify-self-end">
            <a v-if="item.linkLabel && item.linkUrl && isExternal(item.linkUrl)" class="tlink label" :href="item.linkUrl" target="_blank" rel="noopener">{{ item.linkLabel }}</a>
            <NuxtLink v-else-if="item.linkLabel && item.linkUrl" class="tlink label" :to="siteHref(item.linkUrl)">{{ item.linkLabel }}</NuxtLink>
          </p>
        </li>
      </ul>
    </div>
  </section>
</template>
