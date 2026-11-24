<script setup lang="ts">
// Regál's first shelf: six departments as photographs of their own shape standing on the board
// (three to a row on a tablet, two on a phone), the rail under each carrying the name and the
// price range in condensed capitals, the shopkeeper's sentence and the makers hanging below.
import type { Range } from '~/lib/cms-content'

defineProps<{ block: BlockOf<'ranges'>; first?: boolean; anchor?: string; items: Range[] }>()
// The shapes the shelf stands: 3:2, 4:5 and square, whatever the photograph's own is nearest to.
const ratio = (m: Range['image']) => ({ wide: '3 / 2', tall: '4 / 5', square: '1 / 1' })[shapeOf(m)]
</script>

<template>
  <section :id="anchor" class="wrap scroll-mt-4 pt-12 md:pt-9">
    <div class="flex items-end justify-between gap-6 pb-4">
      <component :is="first ? 'h1' : 'h2'" class="cond text-[1.5rem] !font-bold !tracking-[0.04em] md:text-[1.7rem]"><template v-for="(part, i) in slashParts(block.heading)" :key="i"><template v-if="i">{{ ' ' }}<span class="mx-1 opacity-50">/</span>{{ ' ' }}</template>{{ part }}</template></component>
      <p v-if="block.text" class="cond hidden text-[1.2rem] opacity-70 sm:block">{{ block.text }}</p>
    </div>
    <div class="shelf grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
      <article v-for="r in items" :key="r.id" class="bay">
        <div class="stand"><CmsImage v-if="r.image" :media="r.image" sizes="(min-width: 1280px) 15rem, (min-width: 768px) 33vw, 50vw" :style="{ aspectRatio: ratio(r.image) }" /></div>
        <div class="rail"><h3 class="cond text-[1.75rem] !font-bold !tracking-[0.02em] md:text-[1.95rem]">{{ r.name }}</h3><p class="num mt-1 text-[1.45rem] opacity-90">{{ rangePrice(r.priceFrom, r.priceTo) }}</p></div>
        <div class="talk">
          <p v-if="r.text" class="text-[1rem] font-medium leading-snug">„{{ tidyText(r.text) }}“</p>
          <p v-if="r.makers" class="mt-2.5 text-[0.88rem] leading-snug opacity-75">{{ tidyText(r.makers) }}</p>
        </div>
      </article>
    </div>
  </section>
</template>
