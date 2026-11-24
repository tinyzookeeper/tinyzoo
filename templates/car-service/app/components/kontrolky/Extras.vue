<script setup lang="ts">
// Kontrolky's extras: three photographs with a name, a price in the brand colour and a few
// words. A row to swipe on a phone (the cards run to the edge of the screen), three columns from
// a tablet's width.
import type { Extra } from '../../lib/cms-content'

defineProps<{ block: BlockOf<'extras'>; first?: boolean; items: Extra[] }>()
</script>

<template>
  <section class="blk-extras">
    <div class="wrap">
      <component :is="first ? 'h1' : 'h2'" class="text-[32px] sm:text-[38px]">{{ plainEmphasis(block.heading) }}</component>
      <UCarousel
        v-slot="{ item }" :items="items" align="start" contain-scroll="trimSnaps" drag-free
        :ui="{ root: 'mt-9', viewport: '-mx-5 px-5 md:mx-0 md:px-0 pb-2', container: 'items-start -ms-6 md:ms-0 md:gap-6', item: 'basis-[82%] sm:basis-[52%] md:basis-[calc((100%-3rem)/3)] ps-6 md:ps-0' }"
      >
        <article>
          <CmsImage v-if="item.image" :media="item.image" sizes="(min-width: 768px) 24rem, 82vw" class="w-full aspect-[4/3] object-cover rounded-[18px]" />
          <h3 class="mt-6 text-[24px]">{{ item.name }}</h3>
          <p class="dig mt-1.5 text-[20px] font-semibold text-brand">{{ item.unit ? `${item.price} ${item.unit}` : item.price }}</p>
          <p v-if="item.text" class="mt-3 text-[16px] text-quiet">{{ tidyText(item.text) }}</p>
        </article>
      </UCarousel>
    </div>
  </section>
</template>
