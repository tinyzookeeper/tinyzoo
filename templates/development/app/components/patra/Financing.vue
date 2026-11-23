<script setup lang="ts">
// Patra's financing: the payments as rounded blocks whose widths are in the ratio of the shares
// (the first on the soft ground, the second tinted, the last in the brand colour), the amounts
// worked out for the example flat, and the mortgage adviser between two hairlines.
import type { Flat } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'financing'>; first?: boolean; anchor?: string; flats: Flat[] }>()
const example = computed(() => flatByNumber(props.flats, props.block.exampleFlat))
const last = computed(() => props.block.payments.length - 1)
const tone = (i: number) => (i === last.value ? 'on-brand bg-brand text-brand-ink' : i === 0 ? 'bg-soft' : 'bg-tint')
const minWidth = (i: number) => (i === 0 ? 'lg:min-w-[15rem]' : i === 1 ? 'lg:min-w-[17rem]' : '')
</script>

<template>
  <section :id="anchor" class="wrap pt-24 lg:pt-32 scroll-mt-2">
    <div class="grid lg:grid-cols-12 gap-x-12 gap-y-4 items-end">
      <div class="lg:col-span-7">
        <p v-if="block.eyebrow" class="label">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="h2 mt-3">{{ block.heading }}</component>
      </div>
      <p v-if="block.text" class="lead lg:col-span-5">{{ tidyText(block.text) }}</p>
    </div>
    <ol class="mt-10 lg:mt-12 flex flex-col lg:flex-row gap-3">
      <li v-for="(p, i) in block.payments" :key="i" class="lg:flex-(--grow) rounded-[14px] p-6 lg:p-8" :class="[tone(i), minWidth(i)]" :style="{ '--grow': p.share ?? 0 }">
        <p class="serif text-[3.2rem] leading-none! num">{{ p.share }}&nbsp;%</p>
        <p v-if="example?.price" class="mt-4 font-medium num">{{ priceText(shareOf(example.price, p.share ?? 0)) }}</p>
        <p class="mt-1 text-[0.96rem]" :class="i === last ? 'max-w-[30rem] opacity-90' : 'text-quiet'"><template v-if="p.when">{{ p.when }}. </template>{{ tidyText(p.note) }}</p>
      </li>
    </ol>
    <div v-if="block.advisorLead || block.advisorPhone" class="mt-8 lg:mt-10 grid lg:grid-cols-12 gap-x-12 gap-y-4 items-center py-7 border-y border-line">
      <p class="lg:col-span-7"><strong>{{ block.advisorLead }}</strong> <span class="text-quiet">{{ tidyText([block.advisorText, block.advisorNote].filter(Boolean).join(' ')) }}</span></p>
      <p class="lg:col-span-5 flex flex-wrap items-baseline gap-x-6 gap-y-1 lg:justify-end">
        <a v-if="block.advisorPhone" :href="telHref(block.advisorPhone)" class="serif text-[2.1rem] num link">{{ block.advisorPhone }}</a>
        <a v-if="block.advisorEmail" :href="`mailto:${block.advisorEmail}`" class="link">{{ block.advisorEmail }}</a>
      </p>
    </div>
  </section>
</template>
