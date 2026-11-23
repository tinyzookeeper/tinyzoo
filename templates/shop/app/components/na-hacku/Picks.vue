<script setup lang="ts">
// Na háčku's goods: a card on two pegs with the heading, and under it cards hanging on the
// board, each on its peg and a little crooked: the photograph with a tag, the name and the price,
// a note, two round buttons that fill in the enquiry form. Three columns; a swipe row on a phone.
import type { Product } from '~/lib/cms-content'

defineProps<{ block: BlockOf<'picks'>; first?: boolean; anchor?: string; items: Product[] }>()
const { words } = await useShop()
const { fill } = useEnquiryDraft()
const to = siteHref(`/#${anchorOf('ask')}`)
// How crooked each card hangs, in turn (the design's own).
const TILTS = [-1.3, 0.9, -0.6, 1.2, -1, 0.7, -0.8, 1.5, -1.1]
const tilt = (i: number) => ({ '--r': `${TILTS[i % TILTS.length]}deg` })
// The tag's colours by kind: brass for news and gift tips, dark for a last piece, white for an order.
const TAG = { new: 'bg-pop', gift: 'bg-pop', last: 'bg-ink text-card', order: 'bg-card' } as const
</script>

<template>
  <section :id="anchor" class="board scroll-mt-0 py-16 md:py-24">
    <div class="wrap">
      <div class="plate mx-auto max-w-3xl px-6 py-7 text-center md:px-10 md:py-9">
        <span class="peg peg-l" /><span class="peg peg-r" />
        <component :is="first ? 'h1' : 'h2'" class="text-[2.2rem] md:text-[3.1rem]"><KitMarked :text="block.heading" /></component>
        <p v-if="block.text" class="mx-auto mt-3 max-w-xl">{{ tidyText(block.text) }}</p>
      </div>

      <!-- a swipe row on a phone and a tablet, three columns from a desktop up (there the carousel is switched off and its container is a grid) -->
      <UCarousel
        v-slot="{ item, index }" :items="items" align="start" contain-scroll="trimSnaps" drag-free class="mt-10 lg:mt-16"
        :breakpoints="{ '(min-width: 1024px)': { active: false } }"
        :ui="{ viewport: '-mx-5 px-5 pb-8 pt-4 lg:mx-0 lg:overflow-visible lg:p-0', container: 'ms-0 items-start gap-[1.1rem] lg:grid lg:grid-cols-3 lg:gap-x-[2.6rem] lg:gap-y-[3.6rem]', item: 'ps-0 basis-[74%] sm:basis-[42%] lg:basis-auto' }"
      >
        <article class="plate swing p-3 pb-5" :style="tilt(index)" :data-product="item.id">
          <span class="peg" />
          <div class="relative">
            <div class="crop aspect-square rounded-[18px]" :class="productCrop(item) ? '' : 'crop-whole'" :style="productCrop(item) ?? undefined">
              <CmsImage v-if="item.image" :media="item.image" :alt="item.name" sizes="(min-width: 1024px) 70rem, 270vw" />
            </div>
            <span v-if="item.tag" class="pill absolute left-3 top-3" :class="TAG[item.tagKind ?? 'new']">{{ item.tag }}</span>
          </div>
          <div class="px-2.5 pt-4">
            <div class="flex items-start justify-between gap-3"><h3 class="text-[1.4rem] !leading-[1.1]">{{ item.name }}</h3><p v-if="item.price != null" class="disp whitespace-nowrap text-[1.4rem] font-extrabold leading-[1.1]">{{ formatPrice(item.price) }} Kč</p></div>
            <p v-if="item.note" class="mt-1.5 text-[0.97rem]">{{ tidyText(item.note) }}</p>
            <p class="mt-4 flex flex-wrap gap-2">
              <NuxtLink class="btn btn-sm btn-line" :to="to" :data-ask="item.name" @click="fill(item.name)">{{ words.ask }}</NuxtLink>
              <NuxtLink class="btn btn-sm" :to="to" :data-hold="item.name" @click="fill(item.name, true)">{{ item.holdLabel || words.holdDefault }}</NuxtLink>
            </p>
          </div>
        </article>
      </UCarousel>
    </div>
  </section>
</template>
