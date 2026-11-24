<script setup lang="ts">
// Výkres's page of one project (/realizace/dum-v-libici): the name over a heavy rule, the
// photographs on the left, the table of its facts, the text and the client's words on the right.
import type { Project } from '~/lib/cms-content'

const props = defineProps<{ entry: Project }>()
const words = useSiteWords()
const { settings } = await useFirm()
const p = computed(() => props.entry)
const systemLine = computed(() => [systemWord(p.value, words.value), p.value.system !== 'other' ? p.value.systemNote : ''].filter(Boolean).join(', '))
const early = computed(() => weeksEarlier(p.value))
</script>

<template>
  <article class="wrap pb-20 pt-10 md:pt-16 lg:pb-28">
    <p class="lab"><NuxtLink to="/realizace" class="text-ink underline decoration-1 underline-offset-4 hover:text-brand">{{ words.backToProjects }}</NuxtLink></p>
    <div class="mt-6 flex flex-wrap items-end justify-between gap-4 border-b-2 border-ink pb-5">
      <h1 class="font-display text-[38px] font-light leading-[1.08] tracking-[-.025em] text-ink sm:text-[50px]">{{ tidyText(p.name) }}</h1>
      <p class="lab flex items-center gap-3"><KindIcon :kind="p.kind" class="h-6 w-9 text-ink" />{{ [words.kinds[p.kind].one, p.year, p.place].filter(Boolean).join(' · ') }}</p>
    </div>

    <div class="grid gap-10 pt-10 lg:grid-cols-12 lg:gap-8">
      <div class="min-w-0 lg:col-span-7">
        <div v-if="p.photos[0]" class="aspect-[3/2] overflow-hidden bg-tint"><CmsImage :media="p.photos[0]" eager sizes="(min-width: 1280px) 46rem, (min-width: 1024px) 55vw, 100vw" class="h-full w-full object-cover" /></div>
        <div v-if="p.area" class="mt-3"><div class="kota"><span><SupText :text="[`${p.area} m² ${words.areaOf[p.areaMeasure]}`, p.layout].filter(Boolean).join(' · ')" /></span></div></div>
        <div v-if="p.photos.length > 1" class="mt-5 grid grid-cols-2 gap-5">
          <figure v-for="ph in p.photos.slice(1)" :key="ph.id">
            <div class="aspect-[3/2] overflow-hidden bg-tint"><CmsImage :media="ph" sizes="(min-width: 1280px) 22rem, (min-width: 1024px) 27vw, 45vw" class="h-full w-full object-cover" /></div>
            <figcaption v-if="ph.caption" class="lab mt-2">{{ ph.caption }}</figcaption>
          </figure>
        </div>
      </div>
      <div class="lg:col-span-5 lg:pl-6">
        <p v-if="p.summary" class="leading-[1.65]">{{ tidyText(p.summary) }}</p>
        <dl class="border-t border-ink text-[15px]" :class="p.summary ? 'mt-7' : ''">
          <div v-if="p.year" class="flex justify-between gap-6 border-b border-hair py-2.5"><dt class="lab pt-0.5">{{ words.year }}</dt><dd class="text-right font-medium text-ink">{{ p.year }}</dd></div>
          <div v-if="p.area" class="flex justify-between gap-6 border-b border-hair py-2.5"><dt class="lab pt-0.5">{{ words.area[p.areaMeasure] }}</dt><dd class="text-right font-medium text-ink">{{ p.area }} m²</dd></div>
          <div v-if="p.weeks" class="flex justify-between gap-6 border-b border-hair py-2.5"><dt class="lab pt-0.5">{{ words.buildLasted }}</dt><dd class="text-right font-medium text-ink">{{ words.buildTime(p.weeks) }}<template v-if="early && early > 0">, {{ words.earlier(early) }}</template></dd></div>
          <div class="flex justify-between gap-6 border-b border-hair py-2.5"><dt class="lab pt-0.5">{{ words.system }}</dt><dd class="flex items-center gap-2 text-right font-medium text-ink"><i class="hatch" :class="`hatch-${hatchOf(p.system)}`" />{{ systemLine }}</dd></div>
          <div v-for="(row, i) in p.parameters" :key="i" class="flex justify-between gap-6 border-b border-hair py-2.5"><dt class="lab pt-0.5">{{ row.label }}</dt><dd class="text-right font-medium text-ink">{{ row.value }}</dd></div>
          <div v-if="priceRange(p.priceFrom, p.priceTo)" class="flex justify-between gap-6 border-b border-ink py-2.5"><dt class="lab pt-0.5">{{ words.price }}</dt><dd class="text-right font-medium text-ink">{{ priceRange(p.priceFrom, p.priceTo) }}</dd></div>
        </dl>
        <blockquote v-if="p.quote" class="mt-8 bg-tint p-6">
          <p class="font-display text-[19px] font-light leading-[1.5] tracking-[-.01em] text-ink">„{{ tidyText(p.quote) }}“</p>
          <footer v-if="p.quoteAuthor" class="lab mt-4">{{ [p.quoteAuthor, p.quotePlace].filter(Boolean).join(', ') }}</footer>
        </blockquote>
        <NuxtLink v-if="settings?.ctaUrl" :to="siteHref(settings.ctaUrl)" class="btn btn-ink mt-8">{{ words.similar }} <UIcon name="i-lucide-arrow-right" class="size-[18px]" aria-hidden="true" /></NuxtLink>
      </div>
    </div>
  </article>
</template>
