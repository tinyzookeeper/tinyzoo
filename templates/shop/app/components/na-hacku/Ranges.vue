<script setup lang="ts">
// Na háčku's departments on the white wall beside the board: two columns of rows, each a round
// photograph, the name with its price range as an outlined pill, the sentence and the makers.
import type { Range } from '~/lib/cms-content'

defineProps<{ block: BlockOf<'ranges'>; first?: boolean; anchor?: string; items: Range[] }>()
</script>

<template>
  <section :id="anchor" class="wrap scroll-mt-6 py-16 md:py-24">
    <div class="grid items-end gap-6 lg:grid-cols-12">
      <div class="lg:col-span-7">
        <p v-if="block.eyebrow" class="eyebrow">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" :class="block.eyebrow ? 'mt-5' : ''" class="text-[2.3rem] md:text-[3.3rem]"><KitMarked :text="block.heading" /></component>
      </div>
      <p v-if="block.text" class="text-[1.08rem] lg:col-span-5 lg:pb-2">{{ tidyText(block.text) }}</p>
    </div>
    <div class="mt-12 grid gap-x-14 gap-y-10 md:mt-16 lg:grid-cols-2 lg:gap-y-14">
      <article v-for="r in items" :key="r.id" class="range flex items-start gap-5 md:gap-8">
        <div class="round size-24 shrink-0 md:size-40"><CmsImage v-if="r.image" :media="r.image" sizes="(min-width: 768px) 10rem, 6rem" /></div>
        <div class="min-w-0 pt-1 md:pt-3">
          <div class="flex flex-wrap items-center gap-x-3 gap-y-2"><h3 class="text-[1.55rem] md:text-[1.9rem]">{{ r.name }}</h3><span class="pill price">{{ rangePrice(r.priceFrom, r.priceTo) }}</span></div>
          <p v-if="r.text" class="mt-3">„{{ tidyText(r.text) }}“</p>
          <p v-if="r.makers" class="mt-2 text-[0.9rem] font-semibold text-[var(--soft)]">{{ tidyText(r.makers) }}</p>
        </div>
      </article>
    </div>
  </section>
</template>
