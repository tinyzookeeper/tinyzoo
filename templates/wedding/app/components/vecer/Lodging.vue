<script setup lang="ts">
// Večer's places to stay: three columns divided by hairlines on a panel.
import type { Lodging } from '../../lib/cms-content'

defineProps<{ block: BlockOf<'lodging'>; first?: boolean; anchor?: string; items: Lodging[] }>()
</script>

<template>
  <section :id="anchor" class="bg-panel">
    <div class="wrap py-20 lg:py-28">
      <div class="grid lg:grid-cols-12 gap-x-12 gap-y-5 items-end">
        <div class="lg:col-span-5">
          <p v-if="block.eyebrow" class="label text-brand">{{ block.eyebrow }}</p>
          <component :is="first ? 'h1' : 'h2'" class="h2 mt-5"><KitMarked :text="block.heading" /></component>
        </div>
        <p v-if="block.text" class="lg:col-span-6 lg:col-start-7 lg:pb-2">{{ tidyText(block.text) }}</p>
      </div>
      <ul v-if="items.length" class="grid md:grid-cols-3 mt-12 lg:mt-16 border-t border-line md:border-t-0 md:gap-y-12">
        <li
          v-for="(item, i) in items" :key="item.id" class="flex flex-col border-line"
          :class="[i % 3 === 0 ? 'md:pr-10' : i % 3 === 1 ? 'md:px-10 md:border-l' : 'md:pl-10 md:border-l', i === items.length - 1 ? 'pt-8 md:py-2' : 'py-8 md:py-2 max-md:border-b']"
        >
          <p v-if="item.distance" class="label text-brand">{{ [item.distance, item.distance && /\d/.test(item.distance) ? item.distanceNote : ''].filter(Boolean).join(' ') }}</p>
          <h3 class="text-[1.65rem] leading-[1.2] mt-3">{{ tidyText(item.name) }}</h3>
          <p v-if="item.description" class="italic mt-2">{{ tidyText(item.description) }}</p>
          <p v-if="item.price" class="text-ink mt-5 md:mt-auto md:pt-5">{{ tidyText(priceParts(item.price)[0]) }} <span v-if="priceParts(item.price)[1]" class="text-quiet">{{ priceParts(item.price)[1] }}</span></p>
          <a v-if="item.linkLabel && item.linkUrl && isExternal(item.linkUrl)" class="tlink label mt-1 self-start" :href="item.linkUrl" target="_blank" rel="noopener">{{ item.linkLabel }} <UIcon name="i-lucide-arrow-up-right" class="size-4" aria-hidden="true" /></a>
          <NuxtLink v-else-if="item.linkLabel && item.linkUrl" class="tlink label mt-1 self-start" :to="siteHref(item.linkUrl)">{{ item.linkLabel }} <UIcon name="i-lucide-arrow-right" class="size-4" aria-hidden="true" /></NuxtLink>
        </li>
      </ul>
    </div>
  </section>
</template>
