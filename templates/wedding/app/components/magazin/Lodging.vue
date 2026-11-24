<script setup lang="ts">
// Magazín's places to stay: three columns, each led by the distance in large figures.
import type { Lodging } from '../../lib/cms-content'

defineProps<{ block: BlockOf<'lodging'>; first?: boolean; anchor?: string; items: Lodging[] }>()
</script>

<template>
  <section :id="anchor" class="wrap pb-24 lg:pb-36">
    <div class="grid lg:grid-cols-12 gap-x-10 gap-y-5 items-end">
      <div class="lg:col-span-7">
        <p v-if="block.eyebrow" class="label text-brand">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="h2 mt-5"><KitMarked :text="block.heading" /></component>
      </div>
      <p v-if="block.text" class="lg:col-span-4 lg:col-start-9 lg:pb-2 max-w-[30rem]">{{ tidyText(block.text) }}</p>
    </div>
    <ul v-if="items.length" class="grid md:grid-cols-3 gap-x-10 gap-y-0 md:gap-y-12 mt-10 lg:mt-14">
      <li v-for="(item, i) in items" :key="item.id" class="flex flex-col border-t border-ink pt-6" :class="i < items.length - 1 ? 'pb-9 md:pb-0' : ''">
        <p v-if="item.distance" class="flex items-baseline justify-between gap-4"><span class="serif text-ink text-[2.6rem] lg:text-[3.2rem] leading-none">{{ tidyText(item.distance) }}</span><span v-if="item.distanceNote" class="label text-quiet">{{ item.distanceNote }}</span></p>
        <h3 class="text-[1.6rem] leading-[1.2] mt-6">{{ tidyText(item.name) }}</h3>
        <p v-if="item.description" class="mt-2">{{ tidyText(item.description) }}</p>
        <p v-if="item.price" class="text-ink mt-4">{{ tidyText(priceParts(item.price)[0]) }} <span v-if="priceParts(item.price)[1]" class="text-quiet">{{ priceParts(item.price)[1] }}</span></p>
        <a v-if="item.linkLabel && item.linkUrl && isExternal(item.linkUrl)" class="tlink label mt-2 self-start" :href="item.linkUrl" target="_blank" rel="noopener">{{ item.linkLabel }} <UIcon name="i-lucide-arrow-up-right" class="size-4" aria-hidden="true" /></a>
        <NuxtLink v-else-if="item.linkLabel && item.linkUrl" class="tlink label mt-2 self-start" :to="siteHref(item.linkUrl)">{{ item.linkLabel }} <UIcon name="i-lucide-arrow-right" class="size-4" aria-hidden="true" /></NuxtLink>
      </li>
    </ul>
  </section>
</template>
