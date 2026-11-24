<script setup lang="ts">
// Po slunci's financing: three discs whose areas are the shares (they share a baseline), each with
// its share and amount, then the mortgage adviser on a soft rounded card.
import type { Flat } from '../../lib/cms-content'

const props = defineProps<{ block: BlockOf<'financing'>; first?: boolean; anchor?: string; flats: Flat[] }>()
const example = computed(() => flatByNumber(props.flats, props.block.exampleFlat))
const last = computed(() => props.block.payments.length - 1)
// A disc's width is the square root of its share (so its area is the share), the largest being 7 rem on a phone and 13 rem on a desktop.
const root = computed(() => { const max = Math.max(1, ...props.block.payments.map((p) => p.share ?? 0)); return (share: number) => Math.sqrt(share / max).toFixed(4) })
const tone = (i: number) => (i === last.value ? 'bg-brand' : i === 0 ? '' : 'bg-sun')
</script>

<template>
  <section :id="anchor" class="wrap sec scroll-mt-4">
    <div class="head">
      <div>
        <p v-if="block.eyebrow" class="eyebrow">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="h2">{{ block.heading }}</component>
      </div>
      <p v-if="block.text" class="lead">{{ tidyText(block.text) }}</p>
    </div>
    <ol class="gap-head grid lg:grid-cols-3 gap-x-12 gap-y-7">
      <li v-for="(p, i) in block.payments" :key="i" class="grid grid-cols-[7rem_minmax(0,1fr)] lg:grid-cols-1 items-center lg:items-start lg:content-start gap-x-5">
        <div class="flex justify-center lg:justify-start lg:items-end lg:h-[13rem]"><span class="block w-[calc(7rem*var(--k))] lg:w-[calc(13rem*var(--k))] aspect-square rounded-full" :class="tone(i)" :style="{ '--k': root(p.share ?? 0), ...(i === 0 && i !== last ? { background: 'color-mix(in srgb, var(--brand) 22%, var(--paper))' } : {}) }" /></div>
        <div class="lg:mt-6">
          <p class="serif text-[1.55rem] lg:text-[1.9rem] leading-tight num">{{ p.share }}&nbsp;% <template v-if="example?.price"><span class="text-quiet">·</span> {{ priceText(shareOf(example.price, p.share ?? 0)) }}</template></p>
          <p class="mt-1.5 text-[0.96rem] text-quiet"><strong class="text-ink font-semibold">{{ p.when }}.</strong> {{ tidyText(p.note) }}</p>
        </div>
      </li>
    </ol>
    <div v-if="block.advisorLead || block.advisorPhone" class="gap-head card bg-soft grid lg:grid-cols-12 gap-x-12 gap-y-4 items-center">
      <p class="lg:col-span-7 serif text-[1.45rem] leading-snug">{{ tidyText(`${block.advisorLead} ${block.advisorText}`.trim()) }}</p>
      <div class="lg:col-span-5 lg:text-right">
        <p v-if="block.advisorNote" class="text-[0.94rem] text-quiet">{{ block.advisorNote }}</p>
        <p class="mt-1 flex flex-wrap lg:justify-end items-baseline gap-x-5 gap-y-1">
          <a v-if="block.advisorPhone" :href="telHref(block.advisorPhone)" class="serif text-[1.9rem] num link">{{ block.advisorPhone }}</a>
          <a v-if="block.advisorEmail" :href="`mailto:${block.advisorEmail}`" class="link">{{ block.advisorEmail }}</a>
        </p>
      </div>
    </div>
  </section>
</template>
