<script setup lang="ts">
// Obálka's series: a dark band, the photograph bleeding to the left edge, the latest part beside
// it and every part below in a row (a row to swipe on a phone, six to a line on a desktop).
import type { Article, Series } from '~/lib/cms-content'

const props = defineProps<{ block: Pick<BlockOf<'series'>, 'eyebrow' | 'partsLabel'>; first?: boolean; anchor?: string; articles: Article[]; series: Series[]; only?: Series }>()
const { words } = await useBlog()
const tag = await useHeadingTag(() => props.first)
const chosen = computed(() => props.only ?? frontSeries(props.articles, props.series))
const parts = computed(() => (chosen.value ? partsOf(props.articles, chosen.value) : []))
const latest = computed(() => latestPart(parts.value))
const total = computed(() => Math.max(chosen.value?.plannedParts ?? 0, latest.value?.seriesPart ?? 0))
// Every place of the series: the parts that are out, and the empty places of those to come.
const places = computed(() => Array.from({ length: total.value }, (_, i) => {
  const n = i + 1
  const part = parts.value.find((p) => p.seriesPart === n) ?? null
  return { n, part, month: chosen.value?.byMonth ? words.value.months[i] ?? '' : '', current: !!part && part.seriesPart === latest.value?.seriesPart, next: !part && n === (latest.value?.seriesPart ?? 0) + 1 }
}))
const comesOut = computed(() => (chosen.value?.nextDate ? words.value.comesOut(dayMonth(chosen.value.nextDate)) : ''))
</script>

<template>
  <section v-if="chosen" :id="anchor" class="bg-deep text-deep-ink" :aria-labelledby="`${anchor ?? 'series'}-h`">
    <div class="grid lg:grid-cols-12">
      <div class="lg:col-span-7">
        <CmsImage v-if="chosen.image" :media="chosen.image" sizes="(min-width: 1024px) 58vw, 100vw" class="aspect-[3/2] h-full w-full object-cover object-[78%_50%] lg:aspect-auto lg:min-h-[640px]" />
      </div>
      <div class="flex flex-col justify-center px-5 py-12 lg:col-span-5 lg:px-16 lg:py-20" :class="chosen.image ? '' : 'lg:col-span-12'">
        <p class="kicker text-deep-soft">{{ block.eyebrow }}<template v-if="latest?.seriesPart && total"> &nbsp;·&nbsp; {{ words.partOfTotal(latest.seriesPart, total) }}</template></p>
        <component :is="tag" :id="`${anchor ?? 'series'}-h`" class="mt-4 font-display text-[3.4rem] font-extralight leading-[0.98] tracking-[-0.025em] lg:text-[5.2rem]"><NuxtLink :to="`/serial/${chosen.slug}`">{{ chosen.name }}</NuxtLink></component>
        <NuxtLink v-if="latest" :to="articleHref(latest)" class="mt-8 block">
          <h3 class="font-display text-[1.75rem] font-light italic leading-[1.15] lg:text-[2.1rem]"><span class="lift">{{ tidyText(latest.title) }}</span></h3>
          <p v-if="latest.perex" class="mt-4 max-w-[30rem] font-display text-[1.1rem] leading-[1.55] text-deep-ink/90">{{ tidyText(latest.perex) }}</p>
          <p class="byline mt-5 text-deep-soft"><span class="font-bold text-deep-ink">{{ latest.author.name }}</span> &nbsp;·&nbsp; {{ formatDate(latest.publishedAt) }} &nbsp;·&nbsp; {{ words.minRead(minutesOf(latest)) }}</p>
          <p class="mt-8 inline-flex h-12 items-center gap-3 border border-deep-ink/60 px-5 text-[0.98rem] transition-colors hover:bg-deep-ink hover:text-deep">{{ words.readPart(latest.seriesPart ?? 0) }} <UIcon name="i-lucide-arrow-right" aria-hidden="true" /></p>
        </NuxtLink>
        <p v-else-if="chosen.description" class="mt-6 max-w-[30rem] font-display text-[1.1rem] leading-[1.55]">{{ tidyText(chosen.description) }}</p>
      </div>
    </div>

    <div v-if="places.length" class="wrap pb-14 pt-10 lg:pb-20 lg:pt-14">
      <p class="kicker text-deep-soft">{{ block.partsLabel }}</p>
      <!-- a desktop: six to a line -->
      <ol class="mt-5 hidden lg:grid lg:grid-cols-6 lg:gap-x-8 lg:gap-y-8">
        <li v-for="p in places" :key="p.n" class="border-t" :class="p.part ? (p.current ? 'border-deep-ink' : 'border-deep-ink/25') : 'border-dashed border-deep-ink/30'">
          <NuxtLink v-if="p.part" :to="articleHref(p.part)" class="block py-3">
            <span class="font-display text-2xl font-light italic" :class="p.current ? '' : 'text-deep-soft'">{{ p.n }}</span><span class="kicker ml-3" :class="p.current ? '' : 'text-deep-soft'">{{ p.month }}<template v-if="p.current"> &nbsp;·&nbsp; {{ words.newPart }}</template></span>
            <span class="mt-1 block font-display text-[1.08rem] leading-snug"><span class="lift">{{ partTitle(p.part) }}</span></span>
          </NuxtLink>
          <div v-else class="py-3 text-deep-soft"><span class="font-display text-2xl font-light italic">{{ p.n }}</span><span class="kicker ml-3">{{ p.month }}</span><span v-if="p.next && comesOut" class="mt-1 block font-display text-[1.08rem] italic leading-snug">{{ comesOut }}</span></div>
        </li>
      </ol>
      <!-- a phone: a row to swipe -->
      <UCarousel
        v-slot="{ item: p }" :items="places" align="start" contain-scroll="trimSnaps" drag-free class="-mx-5 mt-5 lg:hidden"
        :ui="{ viewport: 'px-5', container: 'items-start -ms-6', item: 'basis-[44%] sm:basis-[28%] ps-6' }"
      >
        <div class="border-t" :class="p.part ? (p.current ? 'border-deep-ink' : 'border-deep-ink/25') : 'border-dashed border-deep-ink/30'">
          <NuxtLink v-if="p.part" :to="articleHref(p.part)" class="block py-3">
            <span class="font-display text-2xl font-light italic" :class="p.current ? '' : 'text-deep-soft'">{{ p.n }}</span><span class="kicker ml-3" :class="p.current ? '' : 'text-deep-soft'">{{ p.month }}<template v-if="p.current"> &nbsp;·&nbsp; {{ words.newPart }}</template></span>
            <span class="mt-1 block font-display text-[1.08rem] leading-snug"><span class="lift">{{ partTitle(p.part) }}</span></span>
          </NuxtLink>
          <div v-else class="py-3 text-deep-soft"><span class="font-display text-2xl font-light italic">{{ p.n }}</span><span class="kicker ml-3">{{ p.month }}</span><span v-if="p.next && comesOut" class="mt-1 block font-display text-[1.08rem] italic leading-snug">{{ comesOut }}</span></div>
        </div>
      </UCarousel>
    </div>
  </section>
</template>
