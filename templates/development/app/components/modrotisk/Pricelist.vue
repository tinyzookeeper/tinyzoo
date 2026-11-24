<script setup lang="ts">
// Modrotisk's price list: the elevation of the building (clicking a bay finds the flat below), a
// filter of squared-off chips, then a ruled table on a desktop and ruled cards on a phone.
// Free flats carry "Mám zájem", which chooses the flat in the enquiry form.
import type { Flat, Floor } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'pricelist'>; first?: boolean; index?: number; anchor?: string; flats: Flat[]; floors: Floor[]; withOverview?: boolean }>()
const { settings } = await useSite()
const words = useSiteWords()
const w = words.value.modrotisk
const { filter, matches, reset, picked, asked, hovered } = useFlatBrowser()
const layouts = computed(() => [{ value: 'all', label: words.value.all }, ...layoutsOf(props.flats).map((l) => ({ value: l, label: l }))])
const states = computed(() => [{ value: 'all', label: words.value.all }, ...statesOf(props.flats).map((s) => ({ value: s, label: words.value.stateFilters[s] }))])
const rows = computed(() => topDown(props.flats))
const shown = computed(() => props.flats.filter(matches).length)
const priceOf = (f: Flat) => (f.state === 'sold' || f.price == null ? '—' : priceText(f.price))
const outdoorOf = (f: Flat) => (f.outdoorKind === 'none' ? '—' : `${words.value.outdoor[f.outdoorKind]} ${areaText(f.outdoorArea)}`)
const floorOf = (f: Flat) => `${words.value.floorNp(f.floor)}${f.floor === 1 ? ` · ${w.footer.ground}` : ''}`
const contact = `/#${anchorOf('enquiry')}`
</script>

<template>
  <section :id="anchor" class="wrap pt-24 lg:pt-32 scroll-mt-4">
    <p class="label sheet"><b>{{ sectionNo(index) }}</b> {{ block.eyebrow }}</p>
    <div class="mt-8 grid lg:grid-cols-12 gap-x-12 gap-y-5">
      <component :is="first ? 'h1' : 'h2'" class="lg:col-span-6 text-[2.5rem] lg:text-[3.6rem]">{{ block.heading }}</component>
      <p v-if="block.text" class="lg:col-span-5 lg:col-start-8 text-quiet self-end">{{ tidyText(block.text) }}</p>
    </div>

    <!-- the building, floor by floor (a page with a block for the building at a glance draws it there) -->
    <ModrotiskElevation v-if="!withOverview" class="mt-12 lg:mt-14" :flats="flats" :floors="floors" />

    <!-- filter -->
    <div class="mt-12 flex flex-col xl:flex-row xl:items-end gap-x-10 gap-y-5">
      <div>
        <p id="f-layout" class="label mb-2">{{ w.cols.layout }}</p>
        <div role="group" aria-labelledby="f-layout" data-filter="layout">
          <UCarousel v-slot="{ item, index: i }" :items="layouts" align="start" contain-scroll="trimSnaps" drag-free :ui="{ viewport: '-mx-5 px-5 md:mx-0 md:px-0 pb-1', container: 'ms-0', item: 'basis-auto ps-0' }">
            <button type="button" class="chip" :class="{ 'chip-first': i === 0 }" :aria-pressed="filter.layout === item.value" @click="filter.layout = item.value">{{ item.label }}</button>
          </UCarousel>
        </div>
      </div>
      <div>
        <p id="f-state" class="label mb-2">{{ w.cols.state }}</p>
        <div role="group" aria-labelledby="f-state" data-filter="state">
          <UCarousel v-slot="{ item, index: i }" :items="states" align="start" contain-scroll="trimSnaps" drag-free :ui="{ viewport: '-mx-5 px-5 md:mx-0 md:px-0 pb-1', container: 'ms-0', item: 'basis-auto ps-0' }">
            <button type="button" class="chip" :class="{ 'chip-first': i === 0 }" :aria-pressed="filter.state === item.value" @click="filter.state = item.value">{{ item.label }}</button>
          </UCarousel>
        </div>
      </div>
      <p class="xl:ml-auto text-quiet text-[0.94rem] xl:pb-3" aria-live="polite">{{ w.shown }}<span class="text-ink font-medium num" data-count>{{ shown }}</span>{{ words.fromTotal(flats.length) }}</p>
    </div>

    <!-- table (desktop) -->
    <div class="mt-6 hidden xl:block">
      <table class="units num">
        <thead>
          <tr>
            <th scope="col" class="pl-[0.6rem]!">{{ w.cols.flat }}</th><th scope="col">{{ w.cols.floor }}</th><th scope="col">{{ w.cols.layout }}</th><th scope="col" class="r">{{ w.cols.area }}</th><th scope="col" class="pl-8!">{{ w.cols.outdoor }}</th><th scope="col">{{ w.cols.orientation }}</th><th scope="col" class="r">{{ w.cols.price }}</th><th scope="col" class="pl-8!">{{ w.cols.state }}</th><th scope="col"><span class="sr-only">{{ w.cols.ask }}</span></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="f in rows" :id="`byt-${f.slug}`" :key="f.id" class="unit" :class="[`s-${f.state}`, { 'is-picked': picked === f.slug }]" :hidden="!matches(f)"
            :data-unit="f.number" @mouseenter="hovered = f.slug" @mouseleave="hovered = null"
          >
            <th scope="row"><NuxtLink class="flat-link" :to="flatHref(f)">{{ f.number }}</NuxtLink></th>
            <td>{{ floorOf(f) }}</td>
            <td>{{ f.layout }}</td>
            <td class="r">{{ areaText(f.area) }}</td>
            <td class="pl-8!">{{ outdoorOf(f) }}</td>
            <td>{{ words.orientation[f.orientation] }}</td>
            <td class="r" :class="f.state === 'sold' ? '' : 'font-medium'">{{ priceOf(f) }}</td>
            <td class="pl-8!"><span class="st" :class="`st-${f.state}`" />{{ words.states[f.state] }}</td>
            <td class="r py-0!"><NuxtLink v-if="f.state === 'free'" class="act" :to="contact" data-pick @click="asked = f.number">{{ words.interested }} <UIcon name="i-lucide-arrow-right" class="size-3.5" aria-hidden="true" /></NuxtLink></td>
          </tr>
        </tbody>
      </table>
    </div>
    <!-- cards (phone and tablet) -->
    <ul class="mt-5 xl:hidden border-t border-ink md:grid md:grid-cols-2 md:gap-x-12">
      <li
        v-for="f in rows" :id="`m-byt-${f.slug}`" :key="f.id" class="unit py-4 border-b" :class="[`s-${f.state}`, { 'is-picked': picked === f.slug }]" style="border-color:var(--line-soft)" :hidden="!matches(f)" :data-unit="f.number"
      >
        <div class="flex items-baseline justify-between gap-4">
          <p class="label" :class="f.state === 'sold' ? '' : 'text-ink!'"><NuxtLink class="flat-link" :to="flatHref(f)">{{ words.flat }} {{ f.number }}</NuxtLink> · {{ words.floorNp(f.floor) }}</p>
          <p class="text-[0.94rem] whitespace-nowrap"><span class="st" :class="`st-${f.state}`" />{{ words.states[f.state] }}</p>
        </div>
        <div class="mt-1.5 flex items-baseline justify-between gap-4">
          <p class="font-display font-light text-[1.7rem] leading-tight tracking-tight">{{ f.layout }} <span class="text-[1.15rem]">· {{ areaText(f.area) }}</span></p>
          <p class="num whitespace-nowrap" :class="f.state === 'sold' ? '' : 'font-medium text-[1.08rem]'">{{ priceOf(f) }}</p>
        </div>
        <div class="flex items-center justify-between gap-4">
          <p class="text-[0.94rem]" :class="f.state === 'sold' ? '' : 'text-quiet'">{{ outdoorOf(f) }} · {{ words.orientation[f.orientation] }}</p>
          <NuxtLink v-if="f.state === 'free'" class="act" :to="contact" :aria-label="words.interestedIn(f.number)" @click="asked = f.number">{{ words.interested }} <UIcon name="i-lucide-arrow-right" class="size-3.5" aria-hidden="true" /></NuxtLink>
          <span v-else class="min-h-8" />
        </div>
      </li>
    </ul>
    <p v-if="!shown" class="py-10 text-quiet border-b border-line">{{ w.empty }}<button type="button" class="link text-ink cursor-pointer" @click="reset()">{{ w.resetFilter }}</button></p>

    <p class="mt-6 max-w-3xl text-[0.94rem] text-quiet">{{ block.note }}<template v-if="settings?.asOf"> {{ w.priceValid(dateNumbers(settings.asOf)) }}</template></p>
  </section>
</template>
