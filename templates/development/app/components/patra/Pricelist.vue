<script setup lang="ts">
// Patra's price list: the flats stacked under four quiet floor numerals (4, 3, 2, 1), the way the
// floors sit on top of each other. Each floor has its rows (a table on a desktop, two-line
// rows on a phone); a floor the filter empties says so, and its numeral fades.
import type { Flat, Floor } from '../../lib/cms-content'

const props = defineProps<{ block: BlockOf<'pricelist'>; first?: boolean; anchor?: string; flats: Flat[]; floors: Floor[] }>()
const words = useSiteWords()
const w = words.value.patra
const { filter, matches, picked, asked } = useFlatBrowser()
const layouts = computed(() => [{ value: 'all', label: words.value.all }, ...layoutsOf(props.flats).map((l) => ({ value: l, label: l }))])
const states = computed(() => [{ value: 'all', label: words.value.all }, ...statesOf(props.flats).map((s) => ({ value: s, label: words.value.stateFilters[s] }))])
const groups = computed(() => floorsOf(props.flats).map((g) => ({ ...g, note: floorNote(g.floor, props.floors), empty: !g.flats.some(matches) })))
const shown = computed(() => props.flats.filter(matches).length)
const outdoorOf = (f: Flat) => (f.outdoorKind === 'none' ? '—' : `${words.value.outdoor[f.outdoorKind]} ${areaText(f.outdoorArea)}`)
const contact = `/#${anchorOf('enquiry')}`
</script>

<template>
  <section :id="anchor" class="wrap pt-24 lg:pt-32 scroll-mt-2">
    <div class="grid lg:grid-cols-12 gap-x-12 gap-y-4 items-end">
      <div class="lg:col-span-6">
        <p v-if="block.eyebrow" class="label">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="h2 mt-3">{{ block.heading }}</component>
      </div>
      <p v-if="block.text" class="lead lg:col-span-5 lg:col-start-8">{{ tidyText(block.text) }}</p>
    </div>

    <div class="mt-10 lg:mt-12 flex flex-col xl:flex-row xl:items-center gap-x-10 gap-y-4">
      <div class="flex items-center gap-4">
        <p id="f-layout" class="text-[0.92rem] font-medium flex-none">{{ w.cols.layout }}</p>
        <div class="seg min-w-0" role="group" aria-labelledby="f-layout" data-filter="layout">
          <UCarousel v-slot="{ item }" :items="layouts" align="start" contain-scroll="trimSnaps" drag-free :ui="{ root: 'min-w-0', container: 'ms-0', item: 'basis-auto ps-0' }">
            <button type="button" class="chip" :aria-pressed="filter.layout === item.value" @click="filter.layout = item.value">{{ item.label }}</button>
          </UCarousel>
        </div>
      </div>
      <div class="flex items-center gap-4">
        <p id="f-state" class="text-[0.92rem] font-medium flex-none">{{ w.cols.state }}</p>
        <div class="seg min-w-0" role="group" aria-labelledby="f-state" data-filter="state">
          <UCarousel v-slot="{ item }" :items="states" align="start" contain-scroll="trimSnaps" drag-free :ui="{ root: 'min-w-0', container: 'ms-0', item: 'basis-auto ps-0' }">
            <button type="button" class="chip" :aria-pressed="filter.state === item.value" @click="filter.state = item.value">{{ item.label }}</button>
          </UCarousel>
        </div>
      </div>
      <p class="xl:ml-auto text-[0.94rem] text-quiet" aria-live="polite">{{ w.shown }}<strong class="text-ink num" data-count>{{ shown }}</strong>{{ words.fromTotal(flats.length) }}</p>
    </div>

    <div class="mt-6 lg:mt-8 border-b border-line">
      <section v-for="g in groups" :key="g.floor" class="floor grid lg:grid-cols-[14rem_minmax(0,1fr)] gap-x-6 border-t border-line py-6 lg:py-9" :class="{ 'is-empty': g.empty }" :data-floor="g.floor">
        <div class="flex lg:block items-end gap-4 pb-3 lg:pb-0">
          <p class="floor-n" aria-hidden="true">{{ g.floor }}</p>
          <div class="lg:mt-5">
            <h3 class="font-sans! font-medium! tracking-normal! text-[1.05rem] leading-snug!">{{ words.floorNp(g.floor) }}</h3>
            <p v-if="g.note" class="text-[0.9rem] text-quiet leading-snug lg:max-w-[11rem]">{{ g.note }}</p>
          </div>
        </div>
        <div>
          <table class="utable num hidden lg:table">
            <caption class="sr-only">{{ w.floorTable(g.floor) }}</caption>
            <colgroup><col style="width:8%"><col style="width:10%"><col style="width:11%"><col style="width:17%"><col style="width:14%"><col style="width:16%"><col style="width:11%"><col style="width:13%"></colgroup>
            <thead class="sr-only"><tr><th scope="col">{{ w.cols.flat }}</th><th scope="col">{{ w.cols.layout }}</th><th scope="col">{{ w.cols.area }}</th><th scope="col">{{ w.cols.outdoor }}</th><th scope="col">{{ w.cols.orientation }}</th><th scope="col">{{ w.cols.price }}</th><th scope="col">{{ w.cols.state }}</th><th scope="col">{{ w.cols.ask }}</th></tr></thead>
            <tbody>
              <tr v-for="f in g.flats" :id="`byt-${f.slug}`" :key="f.id" class="unit" :class="[`s-${f.state}`, { 'is-picked': picked === f.slug }]" :hidden="!matches(f)" :data-unit="f.number">
                <th scope="row"><NuxtLink class="flat-link" :to="flatHref(f)">{{ f.number }}</NuxtLink></th>
                <td class="font-medium!">{{ f.layout }}</td>
                <td>{{ areaText(f.area) }}</td>
                <td>{{ outdoorOf(f) }}</td>
                <td>{{ words.orientation[f.orientation] }}</td>
                <td class="text-right! pr-8!" :class="f.state === 'sold' ? '' : 'font-medium! text-[1.05rem]'">{{ f.state === 'sold' || f.price == null ? '—' : priceText(f.price) }}</td>
                <td><span class="state" :class="`state-${f.state}`">{{ words.states[f.state] }}</span></td>
                <td class="text-right! pr-2!"><NuxtLink v-if="f.state === 'free'" class="go" :to="contact" :aria-label="words.interestedIn(f.number)" data-pick @click="asked = f.number">{{ words.interested }} <UIcon name="i-lucide-arrow-right" class="size-4" aria-hidden="true" /></NuxtLink></td>
              </tr>
            </tbody>
          </table>
          <ul class="lg:hidden">
            <li v-for="f in g.flats" :id="`m-byt-${f.slug}`" :key="f.id" class="unit py-4 border-t border-line" :class="[`s-${f.state}`, { 'is-picked': picked === f.slug }]" :hidden="!matches(f)" :data-unit="f.number">
              <div class="flex items-center justify-between gap-3">
                <p class="text-[1.15rem] font-medium"><NuxtLink class="flat-link" :to="flatHref(f)">{{ f.number }}</NuxtLink><span class="font-light"> · </span>{{ f.layout }}</p>
                <span class="state" :class="`state-${f.state}`">{{ words.states[f.state] }}</span>
              </div>
              <p class="mt-0.5 text-[0.94rem]" :class="f.state === 'sold' ? '' : 'text-quiet'">{{ areaText(f.area) }} · {{ outdoorOf(f) }} · {{ words.orientation[f.orientation] }}</p>
              <div v-if="f.state !== 'sold'" class="mt-1 flex items-center justify-between gap-3 min-h-11">
                <p class="text-[1.15rem] font-medium num">{{ f.price == null ? '—' : priceText(f.price) }}</p>
                <NuxtLink v-if="f.state === 'free'" class="go" :to="contact" :aria-label="words.interestedIn(f.number)" @click="asked = f.number">{{ words.interested }} <UIcon name="i-lucide-arrow-right" class="size-4" aria-hidden="true" /></NuxtLink>
              </div>
            </li>
          </ul>
          <p v-if="g.empty" class="floor-empty py-4 lg:py-5 text-quiet max-lg:border-t border-line">{{ w.emptyFloor }}</p>
        </div>
      </section>
    </div>
    <p v-if="block.note" class="mt-6 max-w-3xl text-[0.92rem] text-quiet">{{ block.note }}</p>
  </section>
</template>
