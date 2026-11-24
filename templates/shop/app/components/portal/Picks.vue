<script setup lang="ts">
// Portál's goods: the one light section, the lit window. Framed photographs on cream, a label,
// the name and the price on one line, a note in italics, two text links that fill in the
// enquiry form. Three columns; a row to swipe on a phone.
import type { Product } from '../../lib/cms-content'

defineProps<{ block: BlockOf<'picks'>; first?: boolean; anchor?: string; items: Product[] }>()
const { words } = await useShop()
const { fill } = useEnquiryDraft()
const to = siteHref(`/#${anchorOf('ask')}`)
</script>

<template>
  <section :id="anchor" class="lit mt-20 scroll-mt-0 bg-glass py-16 text-wood-lo md:mt-28 md:py-24">
    <div class="wrap">
      <div class="grid items-end gap-6 lg:grid-cols-12">
        <div class="lg:col-span-7">
          <p v-if="block.eyebrow" class="caps text-wood">{{ block.eyebrow }}</p>
          <component :is="first ? 'h1' : 'h2'" class="mt-4 text-[2.2rem] md:text-[3.1rem]"><KitMarked :text="block.heading" /></component>
        </div>
        <p v-if="block.text" class="lg:col-span-5 lg:pb-2">{{ tidyText(block.text) }}</p>
      </div>

      <!-- a swipe row on a phone and a tablet, three columns from a desktop up (there the carousel is switched off and its container is a grid) -->
      <UCarousel
        v-slot="{ item }" :items="items" align="start" contain-scroll="trimSnaps" drag-free class="mt-10 md:mt-14"
        :breakpoints="{ '(min-width: 1024px)': { active: false } }"
        :ui="{ viewport: '-mx-5 px-5 lg:mx-0 lg:overflow-visible lg:px-0', container: 'ms-0 items-start gap-4 lg:grid lg:grid-cols-3 lg:gap-x-10 lg:gap-y-[3.25rem]', item: 'ps-0 basis-[76%] sm:basis-[44%] lg:basis-auto' }"
      >
        <article :data-product="item.id">
          <div class="frame">
            <div class="crop aspect-square" :class="productCrop(item) ? '' : 'crop-whole'" :style="productCrop(item) ?? undefined">
              <CmsImage v-if="item.image" :media="item.image" :alt="item.name" sizes="(min-width: 1024px) 70rem, 270vw" />
            </div>
          </div>
          <p v-if="item.tag" class="caps mt-5 text-wood">{{ item.tag }}</p>
          <div class="flex items-baseline justify-between gap-4" :class="item.tag ? 'mt-2' : 'mt-5'"><h3 class="text-[1.4rem]">{{ item.name }}</h3><p v-if="item.price != null" class="fig whitespace-nowrap text-[1.15rem]">{{ formatPrice(item.price) }}&nbsp;Kč</p></div>
          <p v-if="item.note" class="voice mt-1 text-[1.05rem]">{{ tidyText(item.note) }}</p>
          <p class="mt-3 flex gap-6 text-[0.95rem] font-semibold">
            <NuxtLink class="tlink inline-flex min-h-11 items-center" :to="to" :data-ask="item.name" @click="fill(item.name)">{{ words.ask }}</NuxtLink>
            <NuxtLink class="tlink inline-flex min-h-11 items-center" :to="to" :data-hold="item.name" @click="fill(item.name, true)">{{ item.holdLabel || words.holdDefault }}</NuxtLink>
          </p>
        </article>
      </UCarousel>
    </div>
  </section>
</template>
