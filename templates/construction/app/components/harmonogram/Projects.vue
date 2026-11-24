<script setup lang="ts">
// Harmonogram's projects: the highlighted one as a card with two bars (the contract's time
// against the real one), the others as large photographs, each with one bar on a common scale
// so a roof and a house can be compared at a glance.
import type { Project } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'projects'>; first?: boolean; anchor?: string; featured: Project | null; others: Project[] }>()
const words = useSiteWords()
// The filter counts the highlighted project too: it hides when its kind is not chosen.
const filter = useKindFilter(() => (props.featured ? [props.featured, ...props.others] : props.others))
const scale = computed(() => props.block.scaleWeeks || 48)
const early = computed(() => (props.featured ? weeksEarlier(props.featured) : null))
const meta = (p: Project) => [p.year, p.area ? words.value.areaWith(p.area, p.areaMeasure) : '', systemWord(p, words.value), priceRange(p.priceFrom, p.priceTo)].filter(Boolean).join(' · ')
</script>

<template>
  <section :id="anchor" class="wrap scroll-mt-20 pt-20 lg:pt-28">
    <div class="flex flex-wrap items-end justify-between gap-6">
      <div>
        <p v-if="block.eyebrow" class="mono">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="mt-3 text-[48px] font-extrabold leading-[.95] tracking-[-.04em] text-text sm:text-[72px]"><KitMarked :text="block.heading" as="span" :attrs="{ class: 'text-brand' }" /></component>
      </div>
      <KindFilter v-if="block.filter && filter.kinds.value.length > 1" :active="filter.active.value" :kinds="filter.kinds.value" :total="filter.total.value" counts="plain" gap="md" @choose="filter.choose" />
    </div>
    <p v-if="block.text" class="mt-6 max-w-[36em] leading-[1.6] text-quiet">{{ tidyText(block.text) }}</p>

    <!-- the featured one -->
    <article v-if="featured && filter.isShown(featured)" class="mt-10 border border-line bg-surface" :data-project="featured.slug" data-featured>
      <div class="grid lg:grid-cols-12">
        <div class="min-w-0 lg:col-span-7">
          <div v-if="featured.photos[0]" class="aspect-[3/2] overflow-hidden bg-raised"><CmsImage :media="featured.photos[0]" sizes="(min-width: 1320px) 46rem, (min-width: 1024px) 55vw, 100vw" class="h-full w-full object-cover" /></div>
          <div v-if="featured.photos.length > 1" class="grid grid-cols-2 gap-px bg-line pt-px">
            <figure v-for="p in featured.photos.slice(1, 3)" :key="p.id" class="relative bg-surface">
              <div class="aspect-[3/2] overflow-hidden"><CmsImage :media="p" sizes="(min-width: 1320px) 23rem, (min-width: 1024px) 28vw, 50vw" class="h-full w-full object-cover" /></div>
              <figcaption v-if="p.caption" class="mono px-3 py-2.5 sm:px-4">{{ p.caption }}</figcaption>
            </figure>
          </div>
        </div>
        <div class="flex min-w-0 flex-col p-6 sm:p-9 lg:col-span-5 lg:border-l lg:border-line">
          <p class="mono"><span v-if="block.featuredLabel" class="text-brand">{{ block.featuredLabel }}</span><template v-if="block.featuredLabel"> · </template>{{ [words.kinds[featured.kind].one.toLowerCase(), featured.year].filter(Boolean).join(' · ') }}</p>
          <h3 class="mt-4 text-[34px] font-extrabold leading-[1] tracking-[-.035em] text-text sm:text-[44px]"><NuxtLink :to="`/realizace/${featured.slug}`" class="hover:text-brand">{{ tidyText(featured.name) }}</NuxtLink></h3>
          <p v-if="featured.summary" class="mt-5 leading-[1.6] text-quiet">{{ tidyText(featured.summary) }}</p>
          <dl class="mt-7 grid grid-cols-3 border-y border-line">
            <div class="py-4 pr-3"><dt class="mono">{{ words.areaShort.usable }}</dt><dd class="mt-1.5 text-[26px] font-extrabold tracking-[-.03em] text-text [overflow-wrap:normal] sm:text-[30px]">{{ featured.area ? `${featured.area} m²` : '–' }}</dd></div>
            <div class="border-l border-line px-3 py-4 sm:px-4"><dt class="mono">{{ words.systemShort }}</dt><dd class="mt-1.5 text-[26px] font-extrabold tracking-[-.03em] text-text [overflow-wrap:normal] sm:text-[30px]">{{ systemWord(featured, words) || '–' }}</dd></div>
            <div class="border-l border-line py-4 pl-3 sm:pl-4"><dt class="mono">{{ words.priceKey }}</dt><dd class="mt-1.5 whitespace-nowrap text-[26px] font-extrabold tracking-[-.03em] text-text sm:text-[30px]">{{ priceRange(featured.priceFrom, featured.priceTo, false) || '–' }}</dd></div>
          </dl>
          <div v-if="featured.weeks" class="mt-6">
            <template v-if="featured.contractWeeks">
              <div class="flex items-baseline justify-between"><span class="mono">{{ words.contractTerm }}</span><span class="num text-[13px] text-quiet">{{ words.weeks(featured.contractWeeks) }}</span></div>
              <div class="track mt-1.5" :style="{ '--w': scale }"><span class="bar bar-plan" :style="{ '--d': featured.contractWeeks }" /></div>
            </template>
            <div class="flex items-baseline justify-between" :class="featured.contractWeeks ? 'mt-3' : ''"><span class="mono !text-text">{{ words.actual }}</span><span class="num text-[13px] text-brand">{{ [words.weeks(featured.weeks), early && early > 0 ? words.earlier(early) : ''].filter(Boolean).join(' · ') }}</span></div>
            <div class="track mt-1.5" :style="{ '--w': scale }"><span class="bar" :style="{ '--d': featured.weeks }" /></div>
          </div>
          <blockquote v-if="featured.quote" class="mt-8 lg:mt-auto lg:pt-8">
            <p class="text-[21px] font-semibold leading-[1.3] tracking-[-.015em] text-text">„{{ tidyText(featured.quote) }}“</p>
            <footer v-if="featured.quoteAuthor" class="mono mt-3">{{ [featured.quoteAuthor, featured.quotePlace].filter(Boolean).join(', ') }}</footer>
          </blockquote>
        </div>
      </div>
    </article>

    <!-- the others: every bar on the same scale -->
    <h3 v-if="block.moreHeading" class="mono mt-10">{{ block.moreHeading }}</h3>
    <div class="grid gap-8 md:grid-cols-2" :class="block.moreHeading ? 'mt-4' : 'mt-8'">
      <article v-for="p in others.filter((o) => filter.isShown(o))" :key="p.id" :data-project="p.slug">
        <NuxtLink :to="`/realizace/${p.slug}`" class="group block">
          <div class="aspect-[3/2] overflow-hidden bg-surface"><CmsImage v-if="p.photos[0]" :media="p.photos[0]" sizes="(min-width: 1320px) 38rem, (min-width: 768px) 48vw, 100vw" class="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" /></div>
          <div class="mt-4 flex items-baseline justify-between gap-4"><h3 class="text-[24px] font-extrabold tracking-[-.03em] text-text group-hover:text-brand sm:text-[28px]">{{ tidyText(p.name) }}</h3><span class="mono flex-none">{{ words.kinds[p.kind].one }}</span></div>
          <p class="num mt-2 text-[14px] text-quiet">{{ meta(p) }}</p>
          <div v-if="p.weeks" class="mt-4 flex items-center gap-4"><div class="track flex-1" :style="{ '--w': scale }"><span class="bar" :style="{ '--d': p.weeks }" /></div><span class="num w-[76px] flex-none text-right text-[14px] font-medium text-text">{{ words.weeks(p.weeks) }}</span></div>
        </NuxtLink>
      </article>
      <NuxtLink v-if="block.archiveUrl && block.archiveTitle" :to="siteHref(block.archiveUrl)" class="group flex min-h-[260px] flex-col justify-between border border-line p-7 transition-colors hover:border-brand sm:p-9">
        <span class="mono">{{ words.archive }}</span>
        <span>
          <span class="block text-[40px] font-extrabold leading-[.95] tracking-[-.04em] text-text sm:text-[56px] md:text-[44px] lg:text-[56px]"><template v-for="(line, i) in lines(block.archiveTitle)" :key="i"><br v-if="i">{{ line }}</template></span>
          <span v-if="block.archiveLabel" class="mt-5 flex items-center gap-2 font-bold text-brand">{{ block.archiveLabel }} <UIcon name="i-lucide-arrow-right" class="size-[18px]" aria-hidden="true" /></span>
        </span>
      </NuxtLink>
    </div>
    <p v-if="!filter.shown.value.length" class="mt-8 text-quiet">{{ words.filterEmpty }}</p>
    <p v-else class="mono mt-6">{{ words.scaleNote(scale) }}</p>
  </section>
</template>
