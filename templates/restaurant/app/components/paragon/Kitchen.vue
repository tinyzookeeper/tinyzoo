<script setup lang="ts">
// Paragon's kitchen: the cook's print beside a few words, and the suppliers as a delivery note
// on a pink carbon copy, stamped "received", with the delivery's print overlapping it.
import type { Supplier } from '../../lib/cms-content'

const props = defineProps<{ block: BlockOf<'kitchen'>; first?: boolean; anchor?: string; suppliers: Supplier[] }>()
const { name, address, words } = await useRestaurant()
const w = computed(() => words.value.paragon)
const parts = computed(() => twoParagraphs(props.block.text))
</script>

<template>
  <section :id="anchor" class="wrap pb-16 lg:pb-28 scroll-mt-4">
    <div class="grid lg:grid-cols-12 gap-x-14 gap-y-9 items-start">
      <figure v-if="block.image" class="photo lg:col-span-4 max-w-[22rem] lg:max-w-none">
        <CmsImage :media="block.image" sizes="(min-width: 1024px) 24rem, 90vw" class="w-full aspect-[4/5] object-cover" />
        <figcaption v-if="block.imageCaption">{{ w.figure(3, block.imageCaption) }}</figcaption>
      </figure>
      <div :class="block.image ? 'lg:col-span-8 lg:pt-4' : 'lg:col-span-12'">
        <p v-if="block.eyebrow" class="print">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="h mt-4 text-[2.5rem] sm:text-[3.3rem] lg:text-[4rem]"><KitMarked :text="block.heading" plain /></component>
        <div class="mt-7 grid sm:grid-cols-2 gap-x-10 gap-y-5">
          <p v-if="parts[0]">{{ tidyText(parts[0]) }}</p>
          <p v-for="(p, i) in parts[1]" :key="i">{{ tidyText(p) }}</p>
        </div>
      </div>
    </div>

    <div v-if="suppliers.length || block.secondImage" class="mt-12 lg:mt-16 grid lg:grid-cols-12 gap-x-10 gap-y-8 items-center">
      <div v-if="suppliers.length" class="sheet is-tint px-5 pt-9 pb-6 sm:px-9 sm:pt-11 sm:pb-8" :class="block.secondImage ? 'lg:col-span-7' : 'lg:col-span-12'">
        <div class="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 pb-4 border-b-[3px] border-double border-ink">
          <h3 class="h text-[1.7rem] sm:text-[2rem]">{{ block.suppliersHeading }}</h3>
          <p class="text-[.92rem]">{{ w.recipient(name, address) }}</p>
        </div>
        <table class="w-full text-left">
          <thead><tr class="print [&_th]:font-bold [&_th]:py-2.5 border-b rule"><th>{{ w.goods[0] }}</th><th>{{ w.goods[1] }}</th><th class="text-right">{{ w.goods[2] }}</th></tr></thead>
          <tbody class="[&_tr]:border-b [&_tr]:rule [&_td]:py-2.5 [&_td]:align-baseline [&_td]:pr-3">
            <tr v-for="s in suppliers" :key="s.id"><td class="font-bold">{{ tidyText(s.name) }}</td><td>{{ tidyText(s.supplier) }}</td><td class="text-right font-bold whitespace-nowrap !pr-0">{{ s.distance != null ? `${s.distance} ${words.km}` : '' }}</td></tr>
          </tbody>
        </table>
        <div class="mt-5 flex items-center justify-between gap-6">
          <p class="text-[.92rem]">{{ tidyText(block.deliveryNote) }}</p>
          <p class="stamp !rotate-[4deg]">{{ w.received }}</p>
        </div>
      </div>
      <figure v-if="block.secondImage" class="photo lg:-ml-16 relative" :class="suppliers.length ? 'lg:col-span-5' : 'lg:col-span-12'">
        <CmsImage :media="block.secondImage" sizes="(min-width: 1024px) 28rem, 90vw" class="w-full aspect-[3/2] object-cover" />
        <figcaption v-if="block.secondCaption">{{ w.figure(4, block.secondCaption) }}</figcaption>
      </figure>
    </div>
  </section>
</template>
