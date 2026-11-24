<script setup lang="ts">
// Čtvrthodinka's series: the year drawn as a clock. The photograph is in a circle, the parts stand
// where the hours are (the one out last filled, the coming one dashed), and beside it the latest
// part with a button and every part in a list.
import type { Article, Series } from '../../lib/cms-content'

const props = defineProps<{ block: Pick<BlockOf<'series'>, 'eyebrow' | 'partsLabel'>; first?: boolean; anchor?: string; articles: Article[]; series: Series[]; only?: Series }>()
const { words } = await useBlog()
const tag = await useHeadingTag(() => props.first)
const shelf = useShelf()
const chosen = computed(() => props.only ?? frontSeries(props.articles, props.series))
const parts = computed(() => (chosen.value ? partsOf(props.articles, chosen.value) : []))
const latest = computed(() => latestPart(parts.value))
// The clock holds twelve hours; a longer series is drawn with its first twelve places.
const total = computed(() => Math.min(12, Math.max(chosen.value?.plannedParts ?? 0, latest.value?.seriesPart ?? 0)))
const places = computed(() => Array.from({ length: total.value }, (_, i) => {
  const n = i + 1
  const part = parts.value.find((p) => p.seriesPart === n) ?? null
  const month = chosen.value?.byMonth ? words.value.months[i] ?? '' : ''
  return { n, part, month, angle: (n * 12) / total.value, current: !!part && n === latest.value?.seriesPart, title: part ? `${month ? `${month}: ` : ''}${partTitle(part)}` : '' }
}))
const comesOut = computed(() => (chosen.value?.nextDate ? words.value.comesOut(dayMonth(chosen.value.nextDate)) : ''))
const rows = computed(() => Math.ceil(places.value.length / 2))
</script>

<template>
  <section v-if="chosen" :id="anchor" class="wrap py-16 lg:py-28" :aria-labelledby="`${anchor ?? 'series'}-h`" :data-min="latest ? minutesOf(latest) : undefined" :class="{ 'is-dim': latest && shelf.dim(minutesOf(latest)) }">
    <div class="flex flex-wrap items-end justify-between gap-x-8 gap-y-2 border-t-2 border-ink pt-5">
      <p class="flex items-center gap-4 text-[2rem] font-black leading-none tracking-[-0.04em] lg:text-[3rem]"><span class="dial [--size:2.2rem] lg:[--size:2.9rem]" style="--m:45" aria-hidden="true" />{{ block.eyebrow || words.evening }}</p>
      <p class="meta">{{ words.seriesMeta(chosen.plannedParts ?? total, chosen.byMonth) }}</p>
    </div>

    <div class="mt-10 grid items-center gap-x-16 gap-y-10 lg:mt-14 lg:grid-cols-12">
      <div class="lg:col-span-6">
        <div class="year relative mx-auto aspect-square w-full max-w-[36rem]">
          <CmsImage v-if="chosen.image" :media="chosen.image" sizes="(min-width: 1024px) 28rem, 90vw" class="absolute inset-[13%] size-[74%] rounded-full object-cover object-right" />
          <ol :aria-label="words.yearOfParts">
            <li v-for="p in places" :key="p.n">
              <NuxtLink v-if="p.part" :to="articleHref(p.part)" :style="`--i:${p.angle}`" class="year-n flex items-center justify-center rounded-full font-extrabold transition-colors" :class="p.current ? 'size-12 bg-brand text-base font-black text-brand-ink lg:size-14 lg:text-xl' : 'size-11 bg-panel text-[0.9rem] hover:bg-ink hover:text-ground lg:text-base'" :title="p.title" :aria-current="p.current ? 'true' : undefined">{{ p.n }}</NuxtLink>
              <span v-else :style="`--i:${p.angle}`" class="year-n flex size-11 items-center justify-center rounded-full border-2 border-dashed border-rule text-[0.9rem] font-extrabold text-quiet lg:text-base" :title="`${p.month}${comesOut && p.n === (latest?.seriesPart ?? 0) + 1 ? `: ${comesOut}` : ''}`">{{ p.n }}</span>
            </li>
          </ol>
        </div>
      </div>

      <div class="lg:col-span-6">
        <p class="flex items-center gap-3"><span v-if="latest" class="dial" :style="`--m:${minutesOf(latest)}; --size:2.4rem`" aria-hidden="true" /><span v-if="latest" class="text-[1.05rem] font-extrabold">{{ words.min(minutesOf(latest)) }}</span><span v-if="latest?.seriesPart" class="tag">{{ words.partOfTotal(latest.seriesPart, chosen.plannedParts ?? total) }}</span></p>
        <component :is="tag" :id="`${anchor ?? 'series'}-h`" class="mt-5 text-[3.4rem] font-black leading-[0.92] tracking-[-0.05em] lg:text-[5.6rem]"><NuxtLink :to="`/serial/${chosen.slug}`">{{ chosen.name }}</NuxtLink></component>
        <NuxtLink v-if="latest" :to="articleHref(latest)" class="mt-6 block">
          <h3 class="head text-[1.7rem] lg:text-[2.2rem]"><span class="lift">{{ tidyText(latest.title) }}</span></h3>
          <p v-if="latest.perex" class="stand mt-4 max-w-[34rem] text-[1.25rem] lg:text-[1.4rem]">{{ tidyText(latest.perex) }}</p>
          <p class="meta mt-4"><b>{{ latest.author.name }}</b> &nbsp;·&nbsp; {{ dayMonth(latest.publishedAt) }}</p>
          <p class="mt-7 inline-flex h-13 items-center gap-3 rounded-full bg-brand px-7 text-[1.02rem] font-bold text-brand-ink transition-transform hover:-translate-y-0.5">{{ words.readPart(latest.seriesPart ?? 0) }} <UIcon name="i-lucide-arrow-right" aria-hidden="true" /></p>
        </NuxtLink>
        <p v-else-if="chosen.description" class="stand mt-6 max-w-[34rem] text-[1.25rem] lg:text-[1.4rem]">{{ tidyText(chosen.description) }}</p>
        <ol class="mt-10 grid grid-flow-col grid-cols-2 gap-x-8 border-t border-rule pt-4 text-[0.98rem] font-medium" :style="`grid-template-rows: repeat(${rows}, auto)`">
          <li v-for="p in places" :key="p.n">
            <NuxtLink v-if="p.part" :to="articleHref(p.part)" class="flex gap-3 py-3 lg:py-2" :class="p.current ? 'font-extrabold text-brand' : ''"><span class="w-5 shrink-0" :class="p.current ? '' : 'font-extrabold text-quiet'">{{ p.n }}</span><span class="lift">{{ partTitle(p.part) }}</span></NuxtLink>
            <span v-else class="flex gap-3 py-3 text-quiet lg:py-2"><span class="w-5 shrink-0 font-extrabold">{{ p.n }}</span><span>{{ p.n === (latest?.seriesPart ?? 0) + 1 && comesOut ? comesOut : p.month }}</span></span>
          </li>
        </ol>
      </div>
    </div>
  </section>
</template>
