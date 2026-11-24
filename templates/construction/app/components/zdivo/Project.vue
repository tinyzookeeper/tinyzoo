<script setup lang="ts">
// Zdivo's page of one project (/realizace/dum-v-libici): the name in the blocky slab, the
// photographs in a card, the parameters laid as bricks, the text and the client's words.
import type { Project } from '../../lib/cms-content'

const props = defineProps<{ entry: Project }>()
const words = useSiteWords()
const { settings } = await useFirm()
const p = computed(() => props.entry)
</script>

<template>
  <article class="wrap pb-20 pt-6 lg:pb-28 lg:pt-10">
    <p><NuxtLink to="/realizace" class="inline-flex min-h-[44px] items-center gap-2 font-bold text-brand"><UIcon name="i-lucide-arrow-left" class="size-[18px]" aria-hidden="true" />{{ words.backToProjects }}</NuxtLink></p>
    <p class="eyebrow mt-2">{{ [words.kinds[p.kind].one, p.place].filter(Boolean).join(' · ') }}</p>
    <h1 class="mt-2 font-display text-[44px] font-extrabold leading-[.96] tracking-[-.015em] text-ink sm:text-[68px]">{{ tidyText(p.name) }}</h1>

    <div class="mt-8 overflow-hidden rounded-[4px] bg-card">
      <div class="grid lg:grid-cols-12">
        <div class="min-w-0 p-2 lg:col-span-7">
          <div v-if="p.photos[0]" class="aspect-[3/2] overflow-hidden rounded-[3px] bg-brand-3"><CmsImage :media="p.photos[0]" eager sizes="(min-width: 1280px) 46rem, (min-width: 1024px) 55vw, 100vw" class="h-full w-full object-cover" /></div>
          <div v-if="p.photos.length > 1" class="mt-2 grid grid-cols-2 gap-2">
            <figure v-for="ph in p.photos.slice(1)" :key="ph.id" class="relative">
              <div class="aspect-[3/2] overflow-hidden rounded-[3px] bg-brand-3"><CmsImage :media="ph" sizes="(min-width: 1280px) 22rem, (min-width: 1024px) 27vw, 45vw" class="h-full w-full object-cover" /></div>
              <figcaption v-if="ph.caption" class="absolute bottom-2 left-2 rounded-[3px] bg-card px-2.5 py-1 text-[13px] font-semibold text-ink">{{ ph.caption }}</figcaption>
            </figure>
          </div>
        </div>
        <div class="flex min-w-0 flex-col p-6 sm:p-9 lg:col-span-5 lg:pl-8">
          <p v-if="p.summary" class="leading-[1.55]">{{ tidyText(p.summary) }}</p>
          <dl class="grid grid-cols-12 gap-[6px]" :class="p.summary ? 'mt-7' : ''">
            <div v-if="p.area" class="brick t1 col-span-4 !min-h-[76px] !px-3 !py-2.5 sm:!px-4"><dd class="font-display text-[24px] font-extrabold leading-none [overflow-wrap:normal] sm:text-[28px]">{{ p.area }} m²</dd><dt class="mt-1 text-[13px] font-medium">{{ words.areaBrick[p.areaMeasure] }}</dt></div>
            <div v-if="p.weeks" class="brick t2 col-span-4 !min-h-[76px] !px-3 !py-2.5 sm:!px-4"><dd class="font-display text-[24px] font-extrabold leading-none [overflow-wrap:normal] sm:text-[28px]">{{ words.buildTime(p.weeks) }}</dd><dt class="mt-1 text-[13px] font-medium">{{ words.buildLasted.toLowerCase() }}</dt></div>
            <div class="brick t1d col-span-4 !min-h-[76px] !px-3 !py-2.5 sm:!px-4"><dd class="font-display text-[24px] font-extrabold leading-none [overflow-wrap:normal] sm:text-[28px]">{{ systemWord(p, words) }}</dd><dt class="mt-1 text-[13px] font-medium">{{ p.system === 'other' ? '' : p.systemNote }}</dt></div>
            <div v-if="p.year" class="brick t2 col-span-4 !min-h-[76px] !px-3 !py-2.5 sm:!px-4"><dd class="font-display text-[24px] font-extrabold leading-none [overflow-wrap:normal] sm:text-[28px]">{{ p.year }}</dd><dt class="mt-1 text-[13px] font-medium">{{ words.handedOver }}</dt></div>
            <div v-if="priceRange(p.priceFrom, p.priceTo)" class="brick t1 col-span-8 !min-h-[76px] !px-3 !py-2.5 sm:!px-4"><dd class="whitespace-nowrap font-display text-[24px] font-extrabold leading-none [overflow-wrap:normal] sm:text-[28px]">{{ priceRange(p.priceFrom, p.priceTo) }}</dd><dt class="mt-1 text-[13px] font-medium">{{ words.priceBrick }}</dt></div>
            <div v-for="(row, i) in p.parameters" :key="i" class="brick t3 col-span-6 !min-h-[76px] !px-3 !py-2.5 sm:!px-4"><dd class="font-display text-[22px] font-extrabold leading-none">{{ row.value }}</dd><dt class="mt-1 text-[13px] font-medium">{{ row.label.toLowerCase() }}</dt></div>
          </dl>
          <blockquote v-if="p.quote" class="mt-8 lg:mt-auto lg:pt-8">
            <p class="font-display text-[25px] font-medium italic leading-[1.18] text-ink sm:text-[28px]">„{{ tidyText(p.quote) }}“</p>
            <footer v-if="p.quoteAuthor" class="mt-3 text-[15px] font-semibold text-ink">{{ p.quoteAuthor }} <span v-if="p.quotePlace" class="font-normal text-quiet">· {{ p.quotePlace }}</span></footer>
          </blockquote>
        </div>
      </div>
    </div>
    <p v-if="settings?.ctaUrl" class="mt-6"><NuxtLink :to="siteHref(settings.ctaUrl)" class="btn btn-brand">{{ words.similar }} <UIcon name="i-lucide-arrow-right" class="size-[18px]" aria-hidden="true" /></NuxtLink></p>
  </article>
</template>
