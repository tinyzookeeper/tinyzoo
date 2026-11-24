<script setup lang="ts">
// Rozsvíceno's listings: a greeting-like line, the heading and the filter chips (a row to swipe
// on a phone); the cards as a row to swipe on a phone and a grid from a tablet's width up, the
// dashed box that asks what the visitor looks for as the last cell, and a count with an outlined button.
import type { Listing } from '../../lib/cms-content'

type Cell = { kind: 'listing'; listing: Listing; class?: string } | { kind: 'watchdog'; class?: string }
const props = defineProps<{ block: BlockOf<'listings'>; first?: boolean; anchor?: string; listings: Listing[]; total: number; watchdog: SiteForm | null; moreUrl: string | null }>()
const words = useSiteWords()
const w = words.value.rozsviceno
const { filter, set } = useListingFilter()
const visible = computed(() => props.listings.filter((l) => listingMatches(l, filter.value)))
const chips = computed(() => {
  const counts = chipCounts(props.listings)
  return CHIPS.filter((c) => c.id === 'all' || counts[c.id]! > 0).map((c) => ({ ...c, count: counts[c.id]!, label: words.value.chips[c.id as keyof typeof words.value.chips] }))
})
const count = computed(() => (sameFilter(filter.value, NO_FILTER) ? w.shownAll(visible.value.length, props.total) : w.shownSome(visible.value.length)))
const cells = computed<Cell[]>(() => [...visible.value.map((listing) => ({ kind: 'listing' as const, listing })), ...(props.watchdog && !props.watchdog.unavailable.value ? [{ kind: 'watchdog' as const, class: lastCellSpan(visible.value.length, { md: 2, lg: 3 }) }] : [])])
// A new filter shows the row from its start.
const row = ref<{ emblaApi?: { scrollTo: (i: number) => void } } | null>(null)
watch(filter, () => row.value?.emblaApi?.scrollTo(0))
</script>

<template>
  <section :id="anchor" class="wrap pt-20 md:pt-28" :class="moreUrl ? '' : 'pb-16 md:pb-24'">
    <div class="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
      <div>
        <p v-if="block.eyebrow" class="hand text-[1.2rem]">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="mt-2 text-[2.3rem] md:text-[3.2rem]"><KitMarked :text="block.heading" as="span" :attrs="{ class: 'hand' }" /></component>
      </div>
      <UCarousel
        v-slot="{ item }" :items="chips" align="start" contain-scroll="trimSnaps" drag-free role="group" :aria-label="w.chipsLabel"
        :ui="{ root: 'lg:shrink-0', viewport: '-mx-5 px-5 md:mx-0 md:px-0', container: 'gap-2 pb-1 md:flex-wrap lg:flex-nowrap', item: 'basis-auto' }"
      >
        <button class="chip" type="button" :data-filter="item.id" :aria-pressed="sameFilter(filter, item.filter)" @click="set(item.filter)">{{ item.label }} <small>{{ item.count }}</small></button>
      </UCarousel>
    </div>

    <UCarousel
      ref="row" v-slot="{ item }" :items="cells" align="center" contain-scroll="trimSnaps" class="mt-8" data-grid
      :ui="{ viewport: '-mx-5 px-5 pt-[0.4rem] pb-4 md:mx-0 md:p-0 md:overflow-visible', container: 'items-stretch -ms-4 md:ms-0 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-6', item: 'ps-4 md:ps-0 basis-[82%] md:basis-auto' }"
    >
      <RozsvicenoCard v-if="item.kind === 'listing'" :listing="item.listing" />

      <!-- The box that asks what the visitor looks for -->
      <div v-else-if="watchdog" class="rounded-[1.6rem] border-2 border-dashed border-lamp/50 p-7 md:p-8 flex flex-col justify-center h-full" data-cta>
        <p v-if="block.watchdogEyebrow" class="hand text-[1.2rem]">{{ block.watchdogEyebrow }}</p>
        <h3 class="mt-2 text-[1.6rem] leading-[1.15] max-w-[26rem]">{{ tidyText(block.watchdogHeading) }}</h3>
        <p v-if="watchdog.sent.value" class="mt-6 font-medium" role="status">{{ block.watchdogSent || watchdog.successMessage.value }}</p>
        <form v-else :ref="watchdog.el" class="field mt-6 flex flex-wrap gap-3 max-w-[32rem]" novalidate @submit.prevent="watchdog.submit">
          <label class="sr-only" :for="watchdog.id('email')">{{ w.watchdogLabel }}</label>
          <input :id="watchdog.id('email')" v-model="watchdog.values.email" class="flex-[1_1_13rem] !rounded-full" type="email" name="email" :placeholder="w.watchdogPlaceholder" :aria-invalid="!!watchdog.errors.email">
          <button class="btn flex-[0_0_auto]" type="submit" :disabled="watchdog.sending.value">{{ watchdog.sending.value ? words.sending : block.watchdogButton || watchdog.submitLabel.value }}</button>
          <KitFormExtras :form="watchdog" />
          <p v-if="watchdog.errors.email || watchdog.failure.value" class="basis-full field-error" role="alert">{{ watchdog.errors.email || watchdog.failure.value }}</p>
        </form>
      </div>
    </UCarousel>
    <p v-if="!visible.length" class="mt-4 text-quiet" role="status">{{ w.nothing }}</p>

    <div class="mt-4 md:mt-10 flex flex-wrap items-center justify-between gap-4">
      <p class="text-quiet" data-count aria-live="polite">{{ count }}</p>
      <NuxtLink v-if="moreUrl" class="btn btn-line" :to="moreUrl">{{ w.all(total) }} <UIcon name="i-lucide-arrow-right" class="ic size-4" aria-hidden="true" /></NuxtLink>
    </div>
  </section>
</template>
