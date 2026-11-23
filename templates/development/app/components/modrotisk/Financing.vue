<script setup lang="ts">
// Modrotisk's financing: the payments as a dimension chain whose lengths are in the ratio of
// the shares (the last one takes what is left), the amounts worked out for the example flat,
// and the mortgage adviser in a ruled box.
import type { Flat } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'financing'>; first?: boolean; index?: number; anchor?: string; flats: Flat[] }>()
const example = computed(() => flatByNumber(props.flats, props.block.exampleFlat))
// The widths of the three columns: the shares as fractions of the line, none narrower than its text needs.
const columns = computed(() => {
  const list = props.block.payments
  const fr = (n: number) => `minmax(${Math.max(8, Math.min(16, n / 2))}rem, ${n}fr)`
  return list.length === 3 ? `minmax(13rem,1fr) minmax(15rem,2fr) minmax(0,7fr)` : list.map((p) => fr(p.share ?? 0)).join(' ')
})
</script>

<template>
  <section :id="anchor" class="wrap pt-24 lg:pt-32 scroll-mt-4">
    <p class="label sheet"><b>{{ sectionNo(index) }}</b> {{ block.eyebrow }}</p>
    <div class="mt-8 grid lg:grid-cols-12 gap-x-12 gap-y-5">
      <component :is="first ? 'h1' : 'h2'" class="lg:col-span-6 text-[2.5rem] lg:text-[3.6rem]">{{ block.heading }}</component>
      <p v-if="block.text" class="lg:col-span-5 lg:col-start-8 text-quiet self-end">{{ tidyText(block.text) }}</p>
    </div>
    <ol class="chain pay mt-12 grid gap-y-8" :style="{ '--cols': columns }">
      <li v-for="(p, i) in block.payments" :key="i" :class="i < block.payments.length - 1 ? 'pr-6!' : ''">
        <p class="label">{{ p.when }}</p>
        <p class="mt-1 font-display font-light text-[3.1rem] leading-none tracking-tight num">{{ p.share }}&nbsp;%</p>
        <p v-if="example?.price" class="mt-3 num">{{ priceText(shareOf(example.price, p.share ?? 0)) }}</p>
        <p v-if="p.note" class="mt-1 text-[0.94rem] text-quiet" :class="i === block.payments.length - 1 ? 'max-w-[30rem]' : ''">{{ tidyText(p.note) }}</p>
      </li>
    </ol>
    <div v-if="block.advisorLead || block.advisorPhone" class="mt-14 grid lg:grid-cols-12 gap-x-12 gap-y-6 border border-line p-6 lg:p-9">
      <div class="lg:col-span-7">
        <p v-if="block.advisorLabel" class="label">{{ block.advisorLabel }}</p>
        <p class="mt-3 font-display font-light text-[1.7rem] leading-[1.25] tracking-tight">{{ tidyText(`${block.advisorLead} ${block.advisorText}`.trim()) }}</p>
      </div>
      <div class="lg:col-span-4 lg:col-start-9 flex flex-col justify-end gap-1">
        <p v-if="block.advisorNote" class="text-quiet">{{ block.advisorNote }}</p>
        <a v-if="block.advisorPhone" :href="telHref(block.advisorPhone)" class="font-display text-[1.7rem] num link self-start">{{ block.advisorPhone }}</a>
        <a v-if="block.advisorEmail" :href="`mailto:${block.advisorEmail}`" class="link self-start mt-2">{{ block.advisorEmail }}</a>
      </div>
    </div>
  </section>
</template>
