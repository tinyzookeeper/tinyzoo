<script setup lang="ts">
// Šuplíky's extras: three cards with a lacquered lower edge, a photograph, a name, a price in the
// brand colour and a few words. A row to swipe on a phone (the cards run to the edge of the
// screen), three columns from a tablet's width.
import type { Extra } from '~/lib/cms-content'

defineProps<{ block: BlockOf<'extras'>; first?: boolean; items: Extra[] }>()
</script>

<template>
  <section class="blk-extras">
    <div class="wrap">
      <component :is="first ? 'h1' : 'h2'" class="text-[34px] sm:text-[40px]">{{ plainEmphasis(block.heading) }}</component>
      <UCarousel
        v-slot="{ item }" :items="items" align="start" contain-scroll="trimSnaps" drag-free
        :ui="{ root: 'mt-7', viewport: '-mx-5 px-5 md:mx-0 md:px-0 pb-3', container: 'items-start -ms-5 md:ms-0 md:gap-5', item: 'basis-[84%] sm:basis-[52%] md:basis-[calc((100%-2.5rem)/3)] ps-5 md:ps-0' }"
      >
        <article class="rounded-[24px] bg-paper overflow-hidden shadow-[0_6px_0_var(--edge)]">
          <CmsImage v-if="item.image" :media="item.image" sizes="(min-width: 768px) 24rem, 84vw" class="w-full aspect-[16/10] object-cover" />
          <div class="p-6">
            <h3 class="text-[25px]">{{ item.name }}</h3>
            <p class="num text-[30px] text-brand leading-none mt-2">{{ item.price }}<template v-if="item.unit">{{ ' ' }}<span class="font-sans font-medium text-[15px] text-quiet">{{ item.unit }}</span></template></p>
            <p v-if="item.text" class="mt-3 text-[16px] text-quiet">{{ tidyText(item.text) }}</p>
          </div>
        </article>
      </UCarousel>
    </div>
  </section>
</template>
