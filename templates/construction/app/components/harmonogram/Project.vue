<script setup lang="ts">
// Harmonogram's page of one project (/realizace/dum-v-libici): the name very large, the
// photographs, the figures of the build and its length as a bar on the shared scale, the text
// and the client's words.
import type { Project } from '~/lib/cms-content'

const props = defineProps<{ entry: Project }>()
const words = useSiteWords()
const { settings } = await useFirm()
const p = computed(() => props.entry)
const early = computed(() => weeksEarlier(p.value))
const SCALE = 48
</script>

<template>
  <div class="overflow-x-clip">
  <article class="wrap pb-20 pt-10 md:pt-14 lg:pb-28">
    <p class="mono"><NuxtLink to="/realizace" class="hover:!text-brand">{{ words.backToProjects }}</NuxtLink></p>
    <p class="mono mt-6"><span class="text-brand">{{ words.kinds[p.kind].one }}</span><template v-if="p.year || p.place"> · {{ [p.year, p.place].filter(Boolean).join(' · ') }}</template></p>
    <h1 class="mt-3 text-[44px] font-extrabold leading-[.95] tracking-[-.04em] text-text sm:text-[72px]">{{ tidyText(p.name) }}</h1>
    <div class="laser-h mt-8" aria-hidden="true" />

    <div class="mt-10 grid gap-8 lg:grid-cols-12">
      <div class="min-w-0 lg:col-span-7">
        <div v-if="p.photos[0]" class="aspect-[3/2] overflow-hidden bg-surface"><CmsImage :media="p.photos[0]" eager sizes="(min-width: 1320px) 46rem, (min-width: 1024px) 55vw, 100vw" class="h-full w-full object-cover" /></div>
        <div v-if="p.photos.length > 1" class="mt-px grid grid-cols-2 gap-px bg-line pt-px">
          <figure v-for="ph in p.photos.slice(1)" :key="ph.id" class="bg-bg">
            <div class="aspect-[3/2] overflow-hidden"><CmsImage :media="ph" sizes="(min-width: 1320px) 23rem, (min-width: 1024px) 28vw, 50vw" class="h-full w-full object-cover" /></div>
            <figcaption v-if="ph.caption" class="mono py-2.5">{{ ph.caption }}</figcaption>
          </figure>
        </div>
      </div>
      <div class="lg:col-span-5">
        <p v-if="p.summary" class="leading-[1.6] text-quiet">{{ tidyText(p.summary) }}</p>
        <dl class="grid grid-cols-3 border-y border-line" :class="p.summary ? 'mt-7' : ''">
          <div class="py-4 pr-3"><dt class="mono">{{ words.areaShort[p.areaMeasure] }}</dt><dd class="mt-1.5 text-[26px] font-extrabold tracking-[-.03em] text-text">{{ p.area ? `${p.area} m²` : '–' }}</dd></div>
          <div class="border-l border-line px-3 py-4"><dt class="mono">{{ words.systemShort }}</dt><dd class="mt-1.5 text-[26px] font-extrabold tracking-[-.03em] text-text">{{ systemWord(p, words) || '–' }}</dd></div>
          <div class="border-l border-line py-4 pl-3"><dt class="mono">{{ words.priceKey }}</dt><dd class="mt-1.5 whitespace-nowrap text-[26px] font-extrabold tracking-[-.03em] text-text">{{ priceRange(p.priceFrom, p.priceTo, false) || '–' }}</dd></div>
        </dl>
        <div v-if="p.weeks" class="mt-6">
          <template v-if="p.contractWeeks">
            <div class="flex items-baseline justify-between"><span class="mono">{{ words.contractTerm }}</span><span class="num text-[13px] text-quiet">{{ words.weeks(p.contractWeeks) }}</span></div>
            <div class="track mt-1.5" :style="{ '--w': SCALE }"><span class="bar bar-plan" :style="{ '--d': p.contractWeeks }" /></div>
          </template>
          <div class="flex items-baseline justify-between" :class="p.contractWeeks ? 'mt-3' : ''"><span class="mono !text-text">{{ words.actual }}</span><span class="num text-[13px] text-brand">{{ [words.weeks(p.weeks), early && early > 0 ? words.earlier(early) : ''].filter(Boolean).join(' · ') }}</span></div>
          <div class="track mt-1.5" :style="{ '--w': SCALE }"><span class="bar" :style="{ '--d': p.weeks }" /></div>
        </div>
        <dl v-if="p.parameters.length || p.year" class="mt-6 border-t border-line text-[15px]">
          <div v-if="p.year" class="flex justify-between gap-6 border-b border-line py-3"><dt class="mono pt-0.5">{{ words.year }}</dt><dd class="num text-text">{{ p.year }}</dd></div>
          <div v-for="(row, i) in p.parameters" :key="i" class="flex justify-between gap-6 border-b border-line py-3"><dt class="mono pt-0.5">{{ row.label }}</dt><dd class="text-right text-text">{{ row.value }}</dd></div>
        </dl>
        <blockquote v-if="p.quote" class="mt-8">
          <p class="text-[21px] font-semibold leading-[1.3] tracking-[-.015em] text-text">„{{ tidyText(p.quote) }}“</p>
          <footer v-if="p.quoteAuthor" class="mono mt-3">{{ [p.quoteAuthor, p.quotePlace].filter(Boolean).join(', ') }}</footer>
        </blockquote>
        <NuxtLink v-if="settings?.ctaUrl" :to="siteHref(settings.ctaUrl)" class="btn btn-brand mt-8">{{ words.similar }} <UIcon name="i-lucide-arrow-right" class="size-[18px]" aria-hidden="true" /></NuxtLink>
      </div>
    </div>
  </article>
  </div>
</template>
