<script setup lang="ts">
// Katastr's opening: the heading and the photograph of the town in a frame, the cadastral plan
// of the office's street laid over the photograph's lower corner (under it on a phone), and a
// ruled search of one row of cells: sale or rent, kind, place, price.
import type { Listing } from '../../lib/cms-content'

const props = defineProps<{ block: BlockOf<'opening'>; first?: boolean; anchor?: string; listings: Listing[]; total: number; fresh: Listing[]; featured: Listing | null }>()
const { settings, words } = await useOffice()
const w = words.value.katastr
const search = useListingSearch(() => props.listings, () => props.anchor)
const quick = computed(() => props.block.quickLinks.filter((q) => q.url))
</script>

<template>
  <section class="wrap pt-10 md:pt-16">
    <div class="grid lg:grid-cols-12 gap-x-10 gap-y-10 items-start">
      <div class="lg:col-span-6">
        <p v-if="block.eyebrow" class="label text-brand">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="mt-5" :class="byLength(block.heading, [[44, 'text-[2.6rem] leading-[1.06] md:text-[3.6rem] xl:text-[4.25rem] xl:leading-[1.03]'], [72, 'text-[2.2rem] leading-[1.08] md:text-[3rem] xl:text-[3.5rem]']], 'text-[1.9rem] leading-[1.1] md:text-[2.4rem] xl:text-[2.8rem]')"><KitMarked :text="block.heading" /></component>
        <p v-if="block.text" class="mt-6 max-w-[33rem] text-[1.1rem] leading-[1.65]">{{ tidyText(block.text) }}</p>
        <div v-if="(block.primaryLabel && block.primaryUrl) || (block.secondaryLabel && block.secondaryUrl)" class="mt-6 flex flex-wrap gap-x-8 gap-y-1">
          <NuxtLink v-if="block.primaryLabel && block.primaryUrl" class="tlink" :to="siteHref(block.primaryUrl)">{{ block.primaryLabel }} <span class="num text-quiet">({{ total }})</span> <UIcon name="i-lucide-arrow-right" class="ic" aria-hidden="true" /></NuxtLink>
          <NuxtLink v-if="block.secondaryLabel && block.secondaryUrl" class="tlink" :to="siteHref(block.secondaryUrl)">{{ block.secondaryLabel }} <UIcon name="i-lucide-arrow-right" class="ic" aria-hidden="true" /></NuxtLink>
        </div>
      </div>
      <figure class="lg:col-span-6">
        <div class="aspect-[3/2] bg-tint overflow-hidden">
          <CmsImage v-if="block.image" :media="block.image" eager sizes="(min-width: 1024px) 38rem, 100vw" class="w-full h-full object-cover" />
        </div>
        <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-x-6">
          <!-- The cadastral plan: the card overlaps the lower third of the photograph -->
          <div class="plan relative mx-3 -mt-[17%] sm:mx-0 sm:ml-4 sm:-mt-[21%] sm:w-[304px] sm:shrink-0 md:-ml-6 lg:-ml-3 xl:-ml-12 xl:w-[324px] bg-card border border-line p-2.5">
            <KatastrPlanDrawing :street="settings?.planStreet ?? ''" :lane="settings?.planLane ?? ''" />
            <p class="mt-2.5 flex items-baseline justify-between gap-4 text-ink">
              <span class="flex items-baseline gap-2.5"><span class="serif text-[1.5rem] leading-none num">{{ total }}</span><span class="label text-quiet flex items-center gap-1.5"><span class="key" aria-hidden="true" />{{ w.planKey }}</span></span>
              <span class="label text-quiet">{{ w.cadastre(settings?.town ?? '') }}</span>
            </p>
          </div>
          <figcaption v-if="block.imageCaption" class="mt-3 text-right text-[0.85rem] text-quiet">{{ tidyText(block.imageCaption) }}</figcaption>
        </div>
      </figure>
    </div>

    <!-- Search -->
    <form v-if="search.kinds.value.length" class="search mt-10 md:mt-12" :action="`#${anchor}`" :aria-label="w.searchLabel" @submit.prevent="search.submit">
      <div class="cell">
        <span class="label">{{ w.want }}</span>
        <div class="seg" role="group" :aria-label="w.dealLabel">
          <button v-for="d in search.deals.value" :key="d" type="button" :aria-pressed="search.draft.deal === d" :data-seg="d" @click="search.draft.deal = d">{{ w.deals[d] }}</button>
        </div>
      </div>
      <div class="cell half">
        <label class="label" for="s-druh">{{ w.kindLabel }}</label>
        <select id="s-druh" v-model="search.draft.kind"><option v-for="k in search.kinds.value" :key="k" :value="k">{{ w.kinds[k] }}</option></select>
      </div>
      <div class="cell half">
        <label class="label" for="s-kde">{{ w.placeLabel }}</label>
        <select id="s-kde" v-model="search.draft.town"><option value="all">{{ w.anywhere(settings?.town ?? '') }}</option><option v-for="t in search.towns.value" :key="t.value" :value="t.value">{{ t.value }}</option></select>
      </div>
      <div class="cell">
        <label class="label" for="s-cena">{{ w.priceLabel }}</label>
        <select id="s-cena" v-model.number="search.draft.max"><option :value="0">{{ w.noLimit }}</option><option v-for="s in search.steps.value" :key="s" :value="s">{{ w.maxOf(s, search.draft.deal) }}</option></select>
      </div>
      <button class="btn min-h-[60px] lg:min-h-0 lg:px-10" type="submit" data-search><UIcon name="i-lucide-search" class="size-4" aria-hidden="true" /> {{ w.go }}</button>
    </form>
    <p v-if="quick.length" class="mt-4 text-[0.92rem] text-quiet flex flex-wrap gap-x-5 gap-y-1 items-center">
      <span v-if="block.quickLabel">{{ block.quickLabel }}</span>
      <NuxtLink v-for="q in quick" :key="q.id" class="text-ink underline underline-offset-4 decoration-line hover:decoration-brand hover:text-brand transition-colors py-2" :to="siteHref(q.url!)">{{ tidyText(q.label) }}</NuxtLink>
    </p>
  </section>
</template>
