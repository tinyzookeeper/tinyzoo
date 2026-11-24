<script setup lang="ts">
// Výkres's projects: the highlighted one large, its facts as a ruled table, then the others in
// three columns, each with the pictogram of its kind, a three-cell record and the price.
import type { Project } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'projects'>; first?: boolean; anchor?: string; featured: Project | null; others: Project[] }>()
const words = useSiteWords()
const filter = useKindFilter(() => props.others)
const photos = computed(() => (props.featured?.photos ?? []))
// What the large photograph measures: "128 m² užitné plochy · 4+kk · přízemní".
const dimension = computed(() => {
  const p = props.featured
  return p ? [p.area ? `${p.area} m² ${words.value.areaOf[p.areaMeasure]}` : '', p.layout].filter(Boolean).join(' · ') : ''
})
const systemLine = (p: Project) => [systemWord(p, words.value), p.system !== 'other' ? p.systemNote : ''].filter(Boolean).join(', ')
</script>

<template>
  <section :id="anchor" class="wrap scroll-mt-24 pt-20 lg:pt-28">
    <div class="flex flex-wrap items-end justify-between gap-4 border-b-2 border-ink pb-5">
      <component :is="first ? 'h1' : 'h2'" class="font-display text-[32px] font-light leading-tight tracking-[-.02em] text-ink sm:text-[42px]"><KitMarked :text="block.heading" as="span" /></component>
      <p v-if="block.eyebrow" class="lab">{{ block.eyebrow }}</p>
    </div>
    <p v-if="block.text" class="mt-6 max-w-[36em] leading-[1.65]">{{ tidyText(block.text) }}</p>

    <article v-if="featured" class="grid gap-10 pt-10 lg:grid-cols-12 lg:gap-8" data-featured>
      <div class="min-w-0 lg:col-span-7">
        <div v-if="photos[0]" class="aspect-[3/2] overflow-hidden bg-tint"><CmsImage :media="photos[0]" sizes="(min-width: 1280px) 46rem, (min-width: 1024px) 55vw, 100vw" class="h-full w-full object-cover" /></div>
        <div v-if="dimension" class="mt-3"><div class="kota"><span><SupText :text="dimension" /></span></div></div>
        <div v-if="photos.length > 1" class="mt-5 grid grid-cols-2 gap-5">
          <figure v-for="p in photos.slice(1, 3)" :key="p.id">
            <div class="aspect-[3/2] overflow-hidden bg-tint"><CmsImage :media="p" sizes="(min-width: 1280px) 22rem, (min-width: 1024px) 27vw, 45vw" class="h-full w-full object-cover" /></div>
            <figcaption v-if="p.caption" class="lab mt-2">{{ p.caption }}</figcaption>
          </figure>
        </div>
      </div>
      <div class="lg:col-span-5 lg:pl-6">
        <p class="lab flex items-center gap-3"><KindIcon :kind="featured.kind" class="h-6 w-9 text-ink" />{{ [block.featuredLabel, words.kinds[featured.kind].one.toLowerCase()].filter(Boolean).join(' · ') }}</p>
        <h3 class="mt-4 font-display text-[28px] font-normal leading-[1.15] tracking-[-.02em] text-ink sm:text-[34px]">{{ tidyText(featured.name) }}</h3>
        <p v-if="featured.summary" class="mt-5 leading-[1.65]">{{ tidyText(featured.summary) }}</p>
        <dl class="mt-7 border-t border-ink text-[15px]">
          <div v-if="featured.year" class="flex justify-between gap-6 border-b border-hair py-2.5"><dt class="lab pt-0.5">{{ words.year }}</dt><dd class="text-right font-medium text-ink">{{ featured.year }}</dd></div>
          <div v-if="featured.area" class="flex justify-between gap-6 border-b border-hair py-2.5"><dt class="lab pt-0.5">{{ words.area[featured.areaMeasure] }}</dt><dd class="text-right font-medium text-ink">{{ featured.area }} m²</dd></div>
          <div v-if="featured.weeks" class="flex justify-between gap-6 border-b border-hair py-2.5"><dt class="lab pt-0.5">{{ words.buildLasted }}</dt><dd class="text-right font-medium text-ink">{{ words.buildTime(featured.weeks) }}</dd></div>
          <div class="flex justify-between gap-6 border-b border-hair py-2.5"><dt class="lab pt-0.5">{{ words.system }}</dt><dd class="flex items-center gap-2 text-right font-medium text-ink"><i class="hatch" :class="`hatch-${hatchOf(featured.system)}`" />{{ systemLine(featured) }}</dd></div>
          <div v-for="(row, i) in featured.parameters" :key="i" class="flex justify-between gap-6 border-b border-hair py-2.5"><dt class="lab pt-0.5">{{ row.label }}</dt><dd class="text-right font-medium text-ink">{{ row.value }}</dd></div>
          <div v-if="priceRange(featured.priceFrom, featured.priceTo)" class="flex justify-between gap-6 border-b border-ink py-2.5"><dt class="lab pt-0.5">{{ words.price }}</dt><dd class="text-right font-medium text-ink">{{ priceRange(featured.priceFrom, featured.priceTo) }}</dd></div>
        </dl>
        <blockquote v-if="featured.quote" class="mt-8 bg-tint p-6">
          <p class="font-display text-[19px] font-light leading-[1.5] tracking-[-.01em] text-ink">„{{ tidyText(featured.quote) }}“</p>
          <footer v-if="featured.quoteAuthor" class="lab mt-4">{{ [featured.quoteAuthor, featured.quotePlace].filter(Boolean).join(', ') }}</footer>
        </blockquote>
        <NuxtLink :to="`/realizace/${featured.slug}`" class="mt-6 inline-flex min-h-[44px] items-center gap-2 font-medium text-ink underline decoration-1 underline-offset-4 hover:text-brand">{{ words.fullProject(photos.length) }} <UIcon name="i-lucide-arrow-right" class="size-4" aria-hidden="true" /></NuxtLink>
      </div>
    </article>

    <!-- The others, with the filter -->
    <div class="flex flex-wrap items-center justify-between gap-x-6 gap-y-3" :class="featured ? 'mt-16 border-t border-ink pt-5 lg:mt-20' : 'mt-10'">
      <h3 v-if="block.moreHeading" class="font-display text-[22px] font-normal tracking-[-.01em] text-ink">{{ block.moreHeading }}</h3>
      <KindFilter v-if="block.filter && filter.kinds.value.length > 1" :active="filter.active.value" :kinds="filter.kinds.value" :total="filter.total.value" counts="sup" @choose="filter.choose" />
    </div>

    <div class="mt-8 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
      <article v-for="p in filter.shown.value" :key="p.id" :data-project="p.slug">
        <NuxtLink :to="`/realizace/${p.slug}`" class="group block">
          <div class="aspect-[3/2] overflow-hidden bg-tint"><CmsImage v-if="p.photos[0]" :media="p.photos[0]" sizes="(min-width: 1280px) 25rem, (min-width: 640px) 45vw, 100vw" class="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" /></div>
          <div class="mt-4 flex items-start justify-between gap-4">
            <div><h4 class="font-display text-[20px] font-normal leading-snug tracking-[-.01em] text-ink group-hover:text-brand">{{ tidyText(p.name) }}</h4><p class="lab mt-1.5">{{ [words.kinds[p.kind].one, p.year].filter(Boolean).join(' · ') }}</p></div>
            <KindIcon :kind="p.kind" class="mt-1 h-7 w-10 flex-none text-ink" />
          </div>
          <dl class="mt-4 grid grid-cols-3 border-y border-ink text-[15px]">
            <div class="py-2.5 pr-3"><dt class="lab">{{ words.areaShort[p.areaMeasure] }}</dt><dd class="mt-1 font-medium text-ink">{{ p.area ? `${p.area} m²` : '–' }}</dd></div>
            <div class="border-l border-hair px-3 py-2.5"><dt class="lab">{{ words.buildShort }}</dt><dd class="mt-1 font-medium text-ink">{{ p.weeks ? words.buildTime(p.weeks) : '–' }}</dd></div>
            <div class="border-l border-hair py-2.5 pl-3"><dt class="lab">{{ words.systemShort }}</dt><dd class="mt-1 flex items-center gap-2 font-medium text-ink"><i class="hatch" :class="`hatch-${hatchOf(p.system)}`" />{{ systemWord(p, words, true) }}</dd></div>
          </dl>
          <p v-if="priceRange(p.priceFrom, p.priceTo)" class="mt-2.5 flex justify-between text-[15px]"><span class="lab pt-0.5">{{ words.priceKey }}</span><span class="font-medium text-ink">{{ priceRange(p.priceFrom, p.priceTo) }}</span></p>
        </NuxtLink>
      </article>
      <NuxtLink v-if="block.archiveUrl && block.archiveTitle" :to="siteHref(block.archiveUrl)" class="group flex min-h-[220px] flex-col justify-between border border-ink p-6 transition-colors hover:bg-ink hover:text-white">
        <span class="lab group-hover:!text-white">{{ words.archive }}</span>
        <span>
          <span class="block font-display text-[26px] font-light leading-tight tracking-[-.02em] text-ink group-hover:text-white"><template v-for="(line, i) in lines(block.archiveTitle)" :key="i"><br v-if="i">{{ line }}</template></span>
          <span v-if="block.archiveLabel" class="mt-4 flex items-center gap-2 font-data text-[15px] font-semibold uppercase tracking-[.08em] text-ink group-hover:text-white">{{ block.archiveLabel }} <UIcon name="i-lucide-arrow-right" class="size-[18px]" aria-hidden="true" /></span>
        </span>
      </NuxtLink>
    </div>
    <p v-if="!filter.shown.value.length" class="mt-8 text-quiet">{{ words.filterEmpty }}</p>
  </section>
</template>
