<script setup lang="ts">
// Regál's second shelf: smaller things with white price tickets in the rail (name, big price) and
// small flags on the photographs. The last place on the shelf is empty, with a question mark,
// and takes whatever is left of the row. A swipe row on a phone, shelves of three (five on a wide
// screen) from a tablet up, where the carousel is switched off and its container wraps.
import type { Product } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'picks'>; first?: boolean; anchor?: string; items: Product[] }>()
const { words } = await useShop()
const { fill } = useEnquiryDraft()
const to = siteHref(`/#${anchorOf('ask')}`)
// The empty place goes last and takes the rest of the row.
const places = computed<Array<{ product?: Product; class?: string }>>(() => [...props.items.map((product) => ({ product })), { class: 'md:grow' }])
// The flag's colours by the kind of label: Právě dorazilo and Poslední kus bright, a gift tip and an order dark.
const dark = (p: Product) => p.tagKind === 'gift' || p.tagKind === 'order'
</script>

<template>
  <section :id="anchor" class="wrap scroll-mt-4 pt-12 md:pt-20">
    <div class="grid items-end gap-5 pb-8 md:pb-10 lg:grid-cols-12">
      <component :is="first ? 'h1' : 'h2'" class="text-[2.3rem] font-bold tracking-[-0.035em] md:text-[3.5rem] lg:col-span-7"><KitMarked :text="block.heading" /></component>
      <p v-if="block.text" class="max-w-xl lg:col-span-5 lg:pb-2">{{ tidyText(block.text) }}</p>
    </div>
    <div class="picks">
      <UCarousel
        v-slot="{ item }" :items="places" align="start" contain-scroll="trimSnaps" drag-free
        :breakpoints="{ '(min-width: 768px)': { active: false } }"
        :ui="{ viewport: '-mx-5 px-5 md:mx-0 md:overflow-visible md:px-0', container: 'ms-0 md:flex-wrap', item: 'ps-0 basis-[62%] sm:basis-[36%] md:basis-1/3 xl:basis-1/5' }"
      >
        <article v-if="item.product" :data-product="item.product.id" class="flex flex-col">
          <div class="stand">
            <div class="crop aspect-square bg-tint" :class="productCrop(item.product) ? '' : 'crop-whole'" :style="productCrop(item.product) ?? undefined">
              <CmsImage v-if="item.product.image" :media="item.product.image" :alt="item.product.name" sizes="(min-width: 1280px) 60rem, 190vw" />
            </div>
            <span v-if="item.product.tag" class="wob" :class="dark(item.product) ? 'wob-ink' : ''">{{ item.product.tag }}</span>
          </div>
          <div class="rail rail-thin"><div class="ticket"><h3 class="line-clamp-2 text-[1rem] !font-bold !leading-[1.15] !tracking-[-0.01em]">{{ item.product.name }}</h3><p v-if="item.product.price != null" class="num whitespace-nowrap text-[2.3rem]">{{ formatPrice(item.product.price) }}&nbsp;<span class="text-[1.3rem]">Kč</span></p></div></div>
          <div class="talk !px-[5px]">
            <p v-if="item.product.note" class="text-[0.92rem] leading-snug">{{ tidyText(item.product.note) }}</p>
            <p class="mt-3 flex flex-wrap gap-2">
              <NuxtLink class="act" :to="to" :data-ask="item.product.name" @click="fill(item.product.name)">{{ words.ask }}</NuxtLink>
              <NuxtLink class="act act-fill" :to="to" :data-hold="item.product.name" @click="fill(item.product.name, true)">{{ item.product.holdLabel || words.holdDefault }}</NuxtLink>
            </p>
          </div>
        </article>
        <!-- the empty place on the shelf -->
        <NuxtLink v-else :to="to" class="filler group flex flex-col" data-empty-place>
          <div class="stand"><div class="hole flex items-center justify-center border-2 border-dashed border-ink/45 transition-colors group-hover:border-ink"><span class="num text-[7rem] text-ink/35 transition-colors group-hover:text-rail" aria-hidden="true">?</span></div></div>
          <div class="rail rail-thin"><div class="ticket !bg-ink !text-paper"><p class="text-[1rem] font-bold leading-[1.15]">{{ tidyText(block.emptyTitle) }}</p><UIcon name="i-lucide-arrow-right" class="mb-1 text-2xl transition-transform group-hover:translate-x-1" aria-hidden="true" /></div></div>
          <div class="talk !px-[5px]"><p class="text-[0.92rem] leading-snug">{{ tidyText(block.emptyText) }}</p></div>
        </NuxtLink>
      </UCarousel>
    </div>
  </section>
</template>
