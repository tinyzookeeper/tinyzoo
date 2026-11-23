<script setup lang="ts">
// Zdivo's projects: the highlighted one in a card with its parameters laid as six small bricks,
// then the others as a wall: a row of three cards alternates with a row of a half brick, two
// cards and a half brick, and the filter keeps the bond (an unfinished row is closed by a dashed
// slot "yours" and blank bricks). On a phone the cards are a row to swipe.
import type { Project } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'projects'>; first?: boolean; anchor?: string; featured: Project | null; others: Project[] }>()
const words = useSiteWords()
const { settings } = await useFirm()
const filter = useKindFilter(() => props.others)

type Cell = { kind: 'card'; project: Project } | { kind: 'half-1' | 'half-2' | 'slot' | 'blank' }
// The wall as the design lays it: rows of three cards, and rows of half brick, two cards, half
// brick between them; the row that is left unfinished is closed by the slot and blank bricks.
const wall = computed<Cell[]>(() => {
  const cards = filter.shown.value
  const out: Cell[] = []
  let i = 0
  let row = 0
  let slot = false
  let blanks = 0
  while (i < cards.length) {
    const size = row % 2 === 0 ? 3 : 2
    if (size === 2) out.push({ kind: 'half-1' })
    for (let k = 0; k < size; k++) {
      if (i < cards.length) out.push({ kind: 'card', project: cards[i++]! })
      else if (!slot) { out.push({ kind: 'slot' }); slot = true }
      else if (blanks < 2) { out.push({ kind: 'blank' }); blanks++ }
    }
    if (size === 2) out.push({ kind: 'half-2' })
    row++
  }
  return out
})
const hasSlot = computed(() => wall.value.some((c) => c.kind === 'slot'))
const meta = (p: Project) => [p.year, p.area ? words.value.areaWith(p.area, p.areaMeasure) : '', p.weeks ? (p.weeks <= 8 ? words.value.weeks(p.weeks) : `${words.value.buildShort.toLowerCase()} ${words.value.buildTime(p.weeks)}`) : '', systemWord(p, words.value)].filter(Boolean).join(' · ')
</script>

<template>
  <section :id="anchor" class="wrap scroll-mt-24" :class="first ? 'pt-10 lg:pt-14' : ''">
    <div class="flex flex-wrap items-end justify-between gap-6">
      <div>
        <p v-if="block.eyebrow" class="eyebrow">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="h2" :class="block.eyebrow ? 'mt-2' : ''"><KitMarked :text="block.heading" as="span" /></component>
      </div>
      <p v-if="block.text" class="max-w-[26em] leading-[1.5]">{{ tidyText(block.text) }}</p>
    </div>

    <!-- the featured one -->
    <article v-if="featured" class="mt-10 overflow-hidden rounded-[4px] bg-card" data-featured>
      <div class="grid lg:grid-cols-12">
        <div class="min-w-0 p-2 lg:col-span-7">
          <div v-if="featured.photos[0]" class="aspect-[3/2] overflow-hidden rounded-[3px] bg-brand-3"><CmsImage :media="featured.photos[0]" sizes="(min-width: 1280px) 46rem, (min-width: 1024px) 55vw, 100vw" class="h-full w-full object-cover" /></div>
          <div v-if="featured.photos.length > 1" class="mt-2 grid grid-cols-2 gap-2">
            <figure v-for="p in featured.photos.slice(1, 3)" :key="p.id" class="relative">
              <div class="aspect-[3/2] overflow-hidden rounded-[3px] bg-brand-3"><CmsImage :media="p" sizes="(min-width: 1280px) 22rem, (min-width: 1024px) 27vw, 45vw" class="h-full w-full object-cover" /></div>
              <figcaption v-if="p.caption" class="absolute bottom-2 left-2 rounded-[3px] bg-card px-2.5 py-1 text-[13px] font-semibold text-ink">{{ p.caption }}</figcaption>
            </figure>
          </div>
        </div>
        <div class="flex min-w-0 flex-col p-6 sm:p-9 lg:col-span-5 lg:pl-8">
          <p class="eyebrow">{{ [block.featuredLabel, words.kinds[featured.kind].one.toLowerCase()].filter(Boolean).join(' · ') }}</p>
          <h3 class="mt-3 font-display text-[38px] font-extrabold leading-[.98] tracking-[-.015em] text-ink sm:text-[48px]"><NuxtLink :to="`/realizace/${featured.slug}`" class="hover:text-brand">{{ tidyText(featured.name) }}</NuxtLink></h3>
          <p v-if="featured.summary" class="mt-4 leading-[1.55]">{{ tidyText(featured.summary) }}</p>
          <!-- the parameters, laid like bricks (the project's own page has them all) -->
          <dl class="mt-7 grid grid-cols-12 gap-[6px]">
            <div v-if="featured.area" class="brick t1 col-span-4 !min-h-[76px] !px-3 !py-2.5 sm:!px-4"><dd class="font-display text-[24px] font-extrabold leading-none [overflow-wrap:normal] sm:text-[28px]">{{ featured.area }} m²</dd><dt class="mt-1 text-[13px] font-medium">{{ words.areaBrick[featured.areaMeasure] }}</dt></div>
            <div v-if="featured.weeks" class="brick t2 col-span-4 !min-h-[76px] !px-3 !py-2.5 sm:!px-4"><dd class="font-display text-[24px] font-extrabold leading-none [overflow-wrap:normal] sm:text-[28px]">{{ words.buildTime(featured.weeks) }}</dd><dt class="mt-1 text-[13px] font-medium">{{ words.buildLasted.toLowerCase() }}</dt></div>
            <div class="brick t1d col-span-4 !min-h-[76px] !px-3 !py-2.5 sm:!px-4"><dd class="font-display text-[24px] font-extrabold leading-none [overflow-wrap:normal] sm:text-[28px]">{{ systemWord(featured, words) }}</dd><dt class="mt-1 text-[13px] font-medium">{{ featured.system === 'other' ? '' : featured.systemNote }}</dt></div>
            <div class="brick t3 col-span-1 !min-h-[76px] !p-0" aria-hidden="true" />
            <div v-if="featured.year" class="brick t2 col-span-4 !min-h-[76px] !px-3 !py-2.5 sm:!px-4"><dd class="font-display text-[24px] font-extrabold leading-none [overflow-wrap:normal] sm:text-[28px]">{{ featured.year }}</dd><dt class="mt-1 text-[13px] font-medium">{{ words.handedOver }}</dt></div>
            <div v-if="priceRange(featured.priceFrom, featured.priceTo)" class="brick t1 col-span-6 !min-h-[76px] !px-3 !py-2.5 sm:!px-4"><dd class="whitespace-nowrap font-display text-[24px] font-extrabold leading-none [overflow-wrap:normal] sm:text-[28px]">{{ priceRange(featured.priceFrom, featured.priceTo) }}</dd><dt class="mt-1 text-[13px] font-medium">{{ words.priceBrick }}</dt></div>
            <div class="brick t3 col-span-1 !min-h-[76px] !p-0" aria-hidden="true" />
          </dl>
          <blockquote v-if="featured.quote" class="mt-8 lg:mt-auto lg:pt-8">
            <p class="font-display text-[25px] font-medium italic leading-[1.18] text-ink sm:text-[28px]">„{{ tidyText(featured.quote) }}“</p>
            <footer v-if="featured.quoteAuthor" class="mt-3 text-[15px] font-semibold text-ink">{{ featured.quoteAuthor }} <span v-if="featured.quotePlace" class="font-normal text-quiet">· {{ featured.quotePlace }}</span></footer>
          </blockquote>
        </div>
      </div>
    </article>

    <!-- the wall of projects -->
    <div class="flex flex-wrap items-center justify-between gap-x-6 gap-y-3" :class="featured ? 'mt-12' : 'mt-10'">
      <h3 v-if="block.moreHeading" class="font-display text-[30px] font-bold leading-none text-ink">{{ block.moreHeading }}</h3>
      <KindFilter v-if="block.filter && filter.kinds.value.length > 1" :active="filter.active.value" :kinds="filter.kinds.value" :total="filter.total.value" counts="none" gap="md" @choose="filter.choose" />
    </div>

    <!-- a phone: a row to swipe -->
    <UCarousel
      v-slot="{ item }" :items="[...filter.shown.value, ...(hasSlot ? [null] : [])]" align="start" contain-scroll="trimSnaps" drag-free class="-mx-5 mt-6 md:hidden"
      :ui="{ viewport: 'px-5 pb-2', container: 'items-stretch -ms-2', item: 'basis-[82%] ps-2' }"
    >
      <NuxtLink v-if="item" :to="`/realizace/${item.slug}`" class="group flex h-full flex-col rounded-[4px] bg-card p-2 transition-colors hover:bg-white" :data-project="item.slug">
        <div class="relative aspect-[4/3] overflow-hidden rounded-[3px] bg-brand-3"><CmsImage v-if="item.photos[0]" :media="item.photos[0]" sizes="82vw" class="h-full w-full object-cover" /><span class="absolute left-2 top-2 rounded-[3px] bg-card px-2.5 py-1 text-[13px] font-semibold text-ink">{{ words.kinds[item.kind].one }}</span></div>
        <div class="flex flex-1 flex-col px-3 pb-3 pt-4">
          <h4 class="font-display text-[27px] font-bold leading-[1.02] text-ink group-hover:text-brand">{{ tidyText(item.name) }}</h4>
          <p class="mt-2 text-[15px] leading-snug">{{ meta(item) }}</p>
          <p v-if="priceRange(item.priceFrom, item.priceTo)" class="mt-auto pt-3 font-display text-[22px] font-bold text-brand">{{ priceRange(item.priceFrom, item.priceTo) }}</p>
        </div>
      </NuxtLink>
      <NuxtLink v-else :to="siteHref(settings?.ctaUrl)" class="flex h-full rounded-[4px] border-2 border-dashed border-brand p-6 text-ink transition-colors hover:bg-card">
        <span class="flex min-h-[220px] flex-col justify-end"><span class="font-display text-[30px] font-bold leading-[1.02]">{{ words.slotTitle }}</span><span v-if="settings?.ctaLabel" class="mt-2 inline-flex items-center gap-2 font-bold text-brand">{{ settings.ctaLabel }} <UIcon name="i-lucide-arrow-right" class="size-[18px]" aria-hidden="true" /></span></span>
      </NuxtLink>
    </UCarousel>
    <p v-if="block.archiveUrl && block.archiveTitle" class="mt-5 md:hidden"><NuxtLink :to="siteHref(block.archiveUrl)" class="inline-flex min-h-[44px] items-center gap-2 font-bold text-brand">{{ lines(block.archiveTitle).join(' ') }} <UIcon name="i-lucide-arrow-right" class="size-[18px]" aria-hidden="true" /></NuxtLink></p>

    <!-- a tablet and a desktop: the wall -->
    <div class="mt-6 hidden gap-2 md:grid md:grid-cols-2 lg:grid-cols-[repeat(24,minmax(0,1fr))]">
      <template v-for="(cell, i) in wall" :key="i">
        <article v-if="cell.kind === 'card'" class="lg:col-span-8" :data-project="cell.project.slug">
          <NuxtLink :to="`/realizace/${cell.project.slug}`" class="group flex h-full flex-col rounded-[4px] bg-card p-2 transition-colors hover:bg-white">
            <div class="relative aspect-[4/3] overflow-hidden rounded-[3px] bg-brand-3"><CmsImage v-if="cell.project.photos[0]" :media="cell.project.photos[0]" sizes="(min-width: 1280px) 25rem, (min-width: 768px) 45vw, 100vw" class="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" /><span class="absolute left-2 top-2 rounded-[3px] bg-card px-2.5 py-1 text-[13px] font-semibold text-ink">{{ words.kinds[cell.project.kind].one }}</span></div>
            <div class="flex flex-1 flex-col px-3 pb-3 pt-4">
              <h4 class="font-display text-[27px] font-bold leading-[1.02] text-ink group-hover:text-brand">{{ tidyText(cell.project.name) }}</h4>
              <p class="mt-2 text-[15px] leading-snug">{{ meta(cell.project) }}</p>
              <p v-if="priceRange(cell.project.priceFrom, cell.project.priceTo)" class="mt-auto pt-3 font-display text-[22px] font-bold text-brand">{{ priceRange(cell.project.priceFrom, cell.project.priceTo) }}</p>
            </div>
          </NuxtLink>
        </article>
        <div v-else-if="cell.kind === 'half-1' && block.figure" class="brick t1 hidden !justify-end lg:col-span-4 lg:flex"><b>{{ block.figure }}</b><span>{{ block.figureText }}</span></div>
        <NuxtLink v-else-if="cell.kind === 'half-2' && block.archiveUrl && block.archiveLabel" :to="siteHref(block.archiveUrl)" class="brick t2 hidden !justify-end transition-colors hover:bg-brand-3 lg:col-span-4 lg:flex"><span class="font-display !text-[26px] !font-bold !leading-[1.05]">{{ block.archiveLabel }}</span><UIcon name="i-lucide-arrow-right" class="mt-2 size-6" aria-hidden="true" /></NuxtLink>
        <div v-else-if="cell.kind === 'half-1' || cell.kind === 'half-2'" class="brick t3 hidden lg:col-span-4 lg:flex" aria-hidden="true" />
        <NuxtLink v-else-if="cell.kind === 'slot'" :to="siteHref(settings?.ctaUrl)" class="rounded-[4px] border-2 border-dashed border-brand p-6 text-ink transition-colors hover:bg-card lg:col-span-8">
          <span class="flex h-full min-h-[220px] flex-col justify-end"><span class="font-display text-[30px] font-bold leading-[1.02]">{{ words.slotTitle }}</span><span v-if="settings?.ctaLabel" class="mt-2 inline-flex items-center gap-2 font-bold text-brand">{{ settings.ctaLabel }} <UIcon name="i-lucide-arrow-right" class="size-[18px]" aria-hidden="true" /></span></span>
        </NuxtLink>
        <div v-else class="brick t3 hidden lg:col-span-8 lg:flex" aria-hidden="true" />
      </template>
    </div>
    <p v-if="!filter.shown.value.length" class="mt-8 text-quiet">{{ words.filterEmpty }}</p>
  </section>
</template>
