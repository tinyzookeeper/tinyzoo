<script setup lang="ts">
// Cedule's opening: the brand colour across the whole width and a heading of type only, one
// sentence to a line, set as large as a banner. Beside the lead the list of this week's new
// properties, and under all of it a chunky search whose first cell switches sale and rent.
import type { Listing } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'opening'>; first?: boolean; anchor?: string; listings: Listing[]; total: number; fresh: Listing[]; featured: Listing | null }>()
const { settings, words } = await useOffice()
const w = words.value.cedule
const search = useListingSearch(() => props.listings, () => props.anchor)
const news = computed(() => props.fresh.slice(0, 3))
/** Each sentence of the heading stands on its own line: "Písecko na prodej." / "I k pronájmu." */
const lines = computed(() => plainEmphasis(props.block.heading).split(/(?<=[.!?])\s+/).filter(Boolean))
const eyebrow = computed(() => [props.block.eyebrow, w.inOffer(props.total)].filter(Boolean).join(' / '))
const day = (iso: string | null) => { const d = dateParts(iso); return d ? `${d.day}. ${d.monthNumber}.` : '' }
const price = (l: Listing) => priceKc(l.price)
</script>

<template>
  <section class="bg-brand text-brand-ink border-b-2 border-ink">
    <div class="wrap pt-9 md:pt-12 pb-10 md:pb-12">
      <p class="mono caps">{{ eyebrow }}</p>
      <component :is="first ? 'h1' : 'h2'" class="mt-5" :class="byLength(block.heading, [[40, 'text-[3.5rem] leading-[0.9] tracking-[-0.05em] sm:text-[5rem] lg:text-[7.4rem] xl:text-[8.6rem] xl:leading-[0.86]'], [70, 'text-[2.6rem] leading-[0.92] tracking-[-0.05em] sm:text-[3.6rem] lg:text-[5rem] xl:text-[6rem]']], 'text-[2rem] leading-[0.95] tracking-[-0.045em] sm:text-[2.8rem] lg:text-[3.6rem] xl:text-[4.4rem]')"><template v-for="(line, i) in lines" :key="i"><br v-if="i">{{ tidyText(line) }}</template></component>

      <div class="mt-8 lg:mt-10 grid lg:grid-cols-12 gap-x-10 gap-y-8 items-end">
        <div class="lg:col-span-5">
          <p v-if="block.text" class="text-[1.15rem] md:text-[1.3rem] leading-[1.4] font-medium max-w-[30rem]">{{ tidyText(block.text) }}</p>
        </div>
        <div v-if="news.length" class="lg:col-span-7">
          <p class="mono caps pb-2 border-b-2 border-current flex justify-between"><span>{{ w.fresh }}</span><span>{{ w.thisWeek(fresh.length) }}</span></p>
          <ul>
            <li v-for="l in news" :key="l.id"><NuxtLink class="group flex items-center gap-4 py-2.5 border-b-2 border-current" :to="`/nabidka/${l.slug}`">
              <span class="w-[76px] sm:w-[92px] shrink-0 aspect-[4/3] bg-ink overflow-hidden border-2 border-ink"><CmsImage v-if="l.photos[0]" :media="l.photos[0]" alt="" sizes="92px" class="w-full h-full object-cover" /></span>
              <span class="min-w-0 flex-1"><span class="mono caps block">{{ day(l.published) }} <span class="hidden sm:inline">/ {{ words.deal[l.deal] }}</span></span><span class="block font-bold text-[1.05rem] leading-tight tracking-[-0.01em] group-hover:underline underline-offset-4 decoration-2">{{ tidyText(l.shortLine || [l.title, l.town].filter(Boolean).join(', ')) }}</span></span>
              <span class="font-extrabold text-[1.1rem] sm:text-[1.35rem] tracking-[-0.03em] num whitespace-nowrap text-right">{{ price(l) }}<span v-if="l.deal === 'rent'" class="mono font-normal tracking-normal block sm:inline sm:ml-1">{{ w.perMonth }}</span></span>
            </NuxtLink></li>
          </ul>
        </div>
      </div>

      <!-- Search -->
      <form v-if="search.kinds.value.length" class="search mt-9 lg:mt-10" :action="`#${anchor}`" :aria-label="w.searchLabel" @submit.prevent="search.submit">
        <div class="cell full">
          <div class="seg" role="group" :aria-label="w.dealLabel">
            <button v-for="d in search.deals.value" :key="d" type="button" :aria-pressed="search.draft.deal === d" :data-seg="d" @click="search.draft.deal = d">{{ w.deals[d] }}</button>
          </div>
        </div>
        <div class="cell">
          <label class="mono caps" for="s-druh">{{ w.kindLabel }}</label>
          <select id="s-druh" v-model="search.draft.kind"><option v-for="k in search.kinds.value" :key="k" :value="k">{{ w.kinds[k] }}</option></select>
        </div>
        <div class="cell">
          <label class="mono caps" for="s-kde">{{ w.placeLabel }}</label>
          <select id="s-kde" v-model="search.draft.town"><option value="all">{{ w.anywhere(settings?.town ?? '') }}</option><option v-for="t in search.towns.value" :key="t.value" :value="t.value">{{ t.value }}</option></select>
        </div>
        <div class="cell">
          <label class="mono caps" for="s-cena">{{ w.priceLabel }}</label>
          <select id="s-cena" v-model.number="search.draft.max"><option :value="0">{{ w.noLimit }}</option><option v-for="s in search.steps.value" :key="s" :value="s">{{ w.maxOf(s, search.draft.deal) }}</option></select>
        </div>
        <button class="btn go" type="submit" data-search>{{ w.go }} <UIcon name="i-lucide-arrow-right" class="ic size-4" aria-hidden="true" /></button>
      </form>
    </div>
  </section>
</template>
