<script setup lang="ts">
// Čtvero dob's accounts: two strips on one scale (what came in in the brand colour, what went
// out in ink, and what was left in the colour of autumn), then the documents as a card per
// year and the supporters as plain text.
import type { Document, Supporter } from '../../lib/cms-content'

const props = defineProps<{ block: BlockOf<'accounts'>; first?: boolean; anchor?: string; documents: Document[]; supporters: Supporter[] }>()
const { words } = await useAssociation()

const sum = (items: Array<{ amount: number | null }>) => items.reduce((n, i) => n + (i.amount ?? 0), 0)
const incomeTotal = computed(() => sum(props.block.income))
const expenseTotal = computed(() => sum(props.block.expenses))
// Both strips are measured against the larger total, so they can be compared by eye.
const scale = computed(() => Math.max(incomeTotal.value, expenseTotal.value))
const income = computed(() => stripPieces(props.block.income, scale.value))
const expenses = computed(() => stripPieces(props.block.expenses, scale.value))
const leftover = computed(() => Math.max(0, incomeTotal.value - expenseTotal.value))
const leftoverFlex = computed(() => (scale.value > 0 ? Math.round((leftover.value / scale.value) * 10000) / 100 : 0))
// What a strip does not reach of the scale stays empty.
const gap = (total: number) => (scale.value > 0 ? Math.round(((scale.value - total) / scale.value) * 10000) / 100 : 0)
const mix = (token: 'brand' | 'ink', shade: number) => (shade >= 100 ? `var(--${token})` : `color-mix(in srgb, var(--${token}) ${shade}%, var(--paper))`)
const money = (n: number) => `${formatPrice(n)} ${words.value.currency}`

const olderLeftOut = computed(() => (props.block.docYears ?? 0) > 0 && documentYears(props.documents) > props.block.docYears!)
</script>

<template>
  <section :id="anchor" class="scroll-mt-6 bg-sand" :class="first ? 'pb-20 pt-[calc(80px+5rem)] md:pb-24 md:pt-[calc(80px+6rem)]' : 'py-20 md:py-24'">
    <div class="wrap">
      <div class="grid gap-6 lg:grid-cols-12 lg:items-end">
        <component :is="first ? 'h1' : 'h2'" class="h2 lg:col-span-7"><KitMarked :text="block.heading" /></component>
        <p v-if="block.text" class="text-[1.1rem] lg:col-span-5">{{ tidy(block.text) }}</p>
      </div>

      <!-- Two strips on one scale: what came in, what went out, and what was left -->
      <div v-if="income.length || expenses.length" class="mt-12 space-y-10">
        <div v-if="income.length">
          <div class="flex flex-wrap items-baseline justify-between gap-x-6"><h3 class="text-[1.7rem]"><KitMarked :text="block.incomeHeading" /></h3><p class="serif lnum text-[2.2rem] font-extrabold leading-none text-ink">{{ money(incomeTotal) }}</p></div>
          <div class="mt-4 flex h-[58px] gap-[3px] overflow-hidden rounded-[16px]" aria-hidden="true">
            <span v-for="p in income" :key="p.name" :style="{ flex: `${p.flex} 1 0`, background: mix('brand', p.shade) }" />
            <span v-if="gap(incomeTotal) > 0.5" :style="{ flex: `${gap(incomeTotal)} 1 0` }" />
          </div>
          <ol class="mt-5 grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
            <li v-for="p in income" :key="p.name" class="flex items-baseline gap-3 border-b border-[var(--rule)] py-2.5 text-ink"><span class="h-3.5 w-3.5 flex-none translate-y-[2px] rounded-[4px]" :style="{ background: mix('brand', p.shade) }" /><span class="grow">{{ tidy(p.name) }}</span><span class="lnum shrink-0 font-semibold">{{ money(p.amount) }}</span></li>
          </ol>
        </div>
        <div v-if="expenses.length">
          <div class="flex flex-wrap items-baseline justify-between gap-x-6"><h3 class="text-[1.7rem]"><KitMarked :text="block.expensesHeading" /></h3><p class="serif lnum text-[2.2rem] font-extrabold leading-none text-ink">{{ money(expenseTotal) }}</p></div>
          <div class="mt-4 flex h-[58px] gap-[3px] overflow-hidden rounded-[16px]" aria-hidden="true">
            <span v-for="p in expenses" :key="p.name" :style="{ flex: `${p.flex} 1 0`, background: mix('ink', p.shade) }" />
            <span v-if="leftover > 0" class="bg-podzim-m" :style="{ flex: `${leftoverFlex} 1 0` }" />
          </div>
          <ol class="mt-5 grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
            <li v-for="p in expenses" :key="p.name" class="flex items-baseline gap-3 border-b border-[var(--rule)] py-2.5 text-ink"><span class="h-3.5 w-3.5 flex-none translate-y-[2px] rounded-[4px]" :style="{ background: mix('ink', p.shade) }" /><span class="grow">{{ tidy(p.name) }}</span><span class="lnum shrink-0 font-semibold">{{ money(p.amount) }}</span></li>
            <li v-if="leftover > 0 && block.leftoverLabel" class="flex items-baseline gap-3 border-b border-[var(--rule)] py-2.5 text-ink"><span class="h-3.5 w-3.5 flex-none translate-y-[2px] rounded-[4px] bg-podzim-m" /><span class="grow"><template v-for="(part, i) in emphasisParts(block.leftoverLabel)" :key="i"><em v-if="part.marked" class="serif font-semibold">{{ tidy(part.text) }}</em><template v-else>{{ tidy(part.text) }}</template></template></span><span class="lnum shrink-0 font-semibold">{{ money(leftover) }}</span></li>
          </ol>
        </div>
      </div>

      <!-- Documents: a card per year -->
      <template v-if="documents.length">
        <h3 class="mt-20 text-[clamp(1.8rem,3vw,2.4rem)]"><KitMarked :text="block.docsHeading" /></h3>
        <div class="mt-7"><CtveroDobDocumentCards :documents="documents" :years="block.docYears ?? 0" /></div>
        <p v-if="olderLeftOut && block.archive && block.archiveUrl" class="mt-5"><template v-for="(part, i) in emphasisParts(block.archive)" :key="i"><NuxtLink v-if="part.marked" class="u" :to="siteHref(block.archiveUrl)">{{ tidy(part.text) }}</NuxtLink><template v-else>{{ tidy(part.text) }}</template></template></p>
      </template>

      <!-- Supporters, as text -->
      <div v-if="supporters.length" class="grid gap-x-10 gap-y-4 lg:grid-cols-12" :class="documents.length ? 'mt-16' : 'mt-20'">
        <h3 class="text-[1.7rem] lg:col-span-3"><KitMarked :text="block.supportersHeading" /></h3>
        <dl class="grid gap-x-10 gap-y-6 sm:grid-cols-2 lg:col-span-9 lg:grid-cols-3">
          <div v-for="s in supporters" :key="s.id"><dt class="serif text-[1.3rem] font-bold leading-tight text-ink" :class="/\d/.test(s.name) ? 'lnum' : ''">{{ tidy(s.name) }}</dt><dd v-if="s.kind || s.note" class="mt-1">{{ tidy([s.kind, s.note].filter(Boolean).join(' · ')) }}</dd></div>
        </dl>
      </div>
    </div>
  </section>
</template>
