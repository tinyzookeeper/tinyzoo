<script setup lang="ts">
// Po slunci's price list: on a soft rounded slab the flats as soft rows (a table on a desktop,
// cards on a phone) where the side a flat faces is a little compass with the sun and the words
// for when it gets light. Sold flats are dashed and quiet. Free flats carry a round arrow that
// chooses the flat in the enquiry form.
import type { Flat, Floor } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'pricelist'>; first?: boolean; anchor?: string; flats: Flat[]; floors: Floor[] }>()
const { settings } = await useSite()
const words = useSiteWords()
const w = words.value.poSlunci
const { filter, matches, reset, picked, asked, hovered } = useFlatBrowser()
const layouts = computed(() => [{ value: 'all', label: words.value.all }, ...layoutsOf(props.flats).map((l) => ({ value: l, label: l }))])
const states = computed(() => [{ value: 'all', label: words.value.all }, ...statesOf(props.flats).map((s) => ({ value: s, label: words.value.stateFilters[s] }))])
const rows = computed(() => topDown(props.flats))
const shown = computed(() => props.flats.filter(matches).length)
const priceOf = (f: Flat) => (f.state === 'sold' || f.price == null ? '—' : priceText(f.price))
const outdoorOf = (f: Flat) => (f.outdoorKind === 'none' ? '—' : `${words.value.outdoor[f.outdoorKind]} ${areaText(f.outdoorArea)}`)
const contact = `/#${anchorOf('enquiry')}`
</script>

<template>
  <section :id="anchor" class="slab bg-soft scroll-mt-4">
    <div class="wrap">
      <div class="head">
        <div>
          <p v-if="block.eyebrow" class="eyebrow">{{ block.eyebrow }}</p>
          <component :is="first ? 'h1' : 'h2'" class="h2">{{ block.heading }}</component>
        </div>
        <p v-if="block.text" class="lead">{{ tidyText(block.text) }}</p>
      </div>

      <div class="gap-head flex flex-col xl:flex-row xl:items-center gap-x-8 gap-y-3">
        <div class="flex items-center gap-3">
          <p id="f-layout" class="text-[0.9rem] font-semibold text-quiet flex-none">{{ w.cols.layout }}</p>
          <div class="seg min-w-0" role="group" aria-labelledby="f-layout" data-filter="layout">
            <UCarousel v-slot="{ item }" :items="layouts" align="start" contain-scroll="trimSnaps" drag-free :ui="{ root: 'min-w-0', container: '-ms-1', item: 'basis-auto ps-1' }">
              <button type="button" class="tab" :aria-pressed="filter.layout === item.value" @click="filter.layout = item.value">{{ item.label }}</button>
            </UCarousel>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <p id="f-state" class="text-[0.9rem] font-semibold text-quiet flex-none">{{ w.cols.state }}</p>
          <div class="seg min-w-0" role="group" aria-labelledby="f-state" data-filter="state">
            <UCarousel v-slot="{ item }" :items="states" align="start" contain-scroll="trimSnaps" drag-free :ui="{ root: 'min-w-0', container: '-ms-1', item: 'basis-auto ps-1' }">
              <button type="button" class="tab" :aria-pressed="filter.state === item.value" @click="filter.state = item.value">{{ item.label }}</button>
            </UCarousel>
          </div>
        </div>
        <p class="xl:ml-auto text-[0.94rem] text-quiet" aria-live="polite">{{ w.seen }}<strong class="text-ink num" data-count>{{ shown }}</strong>{{ words.fromTotal(flats.length) }}</p>
      </div>

      <div class="mt-5 hidden lg:block">
        <table class="units num">
          <thead>
            <tr>
              <th scope="col" class="pl-6!">{{ w.cols.flat }}</th><th scope="col">{{ w.cols.floor }}</th><th scope="col">{{ w.cols.layout }}</th><th scope="col">{{ w.cols.area }}</th><th scope="col">{{ w.cols.outdoor }}</th><th scope="col">{{ w.cols.sun }}</th><th scope="col" class="text-right! pr-8!">{{ w.cols.price }}</th><th scope="col">{{ w.cols.state }}</th><th scope="col"><span class="sr-only">{{ w.cols.ask }}</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="f in rows" :id="`byt-${f.slug}`" :key="f.id" class="unit" :class="[`s-${f.state}`, { 'is-picked': picked === f.slug }]" :hidden="!matches(f)" :data-unit="f.number" @mouseenter="hovered = f.slug" @mouseleave="hovered = null">
              <th scope="row"><NuxtLink class="flat-link" :to="flatHref(f)">{{ f.number }}</NuxtLink></th>
              <td>{{ words.floorNp(f.floor) }}</td>
              <td class="font-semibold">{{ f.layout }}</td>
              <td>{{ areaText(f.area) }}</td>
              <td>{{ outdoorOf(f) }}</td>
              <td><PoSlunciSun :orientation="f.orientation" /> {{ words.sun[f.orientation] }}</td>
              <td class="text-right! pr-8!" :class="f.state === 'sold' ? '' : 'font-semibold text-[1.08rem]'">{{ priceOf(f) }}</td>
              <td><span class="state" :class="`state-${f.state}`">{{ words.states[f.state] }}</span></td>
              <td class="text-right!"><NuxtLink v-if="f.state === 'free'" class="go" :to="contact" :aria-label="words.interestedIn(f.number)" data-pick @click="asked = f.number"><UIcon name="i-lucide-arrow-right" class="size-5" aria-hidden="true" /></NuxtLink></td>
            </tr>
          </tbody>
        </table>
      </div>
      <ul class="mt-6 lg:hidden flex flex-col gap-2.5">
        <li v-for="f in rows" :id="`m-byt-${f.slug}`" :key="f.id" class="unit ucard" :class="[`s-${f.state}`, { 'is-picked': picked === f.slug }]" :hidden="!matches(f)" :data-unit="f.number">
          <div class="flex items-center justify-between gap-3">
            <p class="serif text-[1.55rem] leading-tight"><NuxtLink class="flat-link" :to="flatHref(f)">{{ f.number }}</NuxtLink> <span class="font-sans text-[1.05rem] font-semibold">· {{ f.layout }}</span></p>
            <span class="state" :class="`state-${f.state}`">{{ words.states[f.state] }}</span>
          </div>
          <p class="mt-1.5 text-[0.94rem]">{{ words.floorNp(f.floor) }} · {{ areaText(f.area) }} · {{ outdoorOf(f) }}</p>
          <p class="mt-2 text-[0.94rem]"><PoSlunciSun :orientation="f.orientation" /> {{ words.sun[f.orientation] }}</p>
          <div v-if="f.state !== 'sold'" class="mt-2 flex items-center justify-between gap-3">
            <p class="text-[1.25rem] font-bold num">{{ f.price == null ? '—' : priceText(f.price) }}</p>
            <NuxtLink v-if="f.state === 'free'" class="go" :to="contact" :aria-label="words.interestedIn(f.number)" @click="asked = f.number"><UIcon name="i-lucide-arrow-right" class="size-5" aria-hidden="true" /></NuxtLink>
          </div>
        </li>
      </ul>
      <p v-if="!shown" class="mt-5 rounded-[1.25rem] border-[1.5px] border-dashed px-6 py-8" style="border-color:var(--dash)">{{ w.empty }}<button type="button" class="link font-semibold cursor-pointer" @click="reset()">{{ w.showAll }}</button></p>
      <p class="mt-6 max-w-3xl text-[0.9rem] text-quiet">{{ block.note }}<template v-if="settings?.asOf"> {{ w.priceValid(dateNumbers(settings.asOf)) }}</template></p>
    </div>
  </section>
</template>
