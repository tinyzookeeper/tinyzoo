<script setup lang="ts">
// Cedule's listings: the heading set huge with the number of properties as a small raised
// figure, the filter chips beside it (a row to swipe on a phone), then the cards as one ruled
// sheet of up to four columns, the black cell that watches the offer filling the last row, and
// a count with a ghost button to the whole offer.
import type { Listing } from '../../lib/cms-content'

const props = defineProps<{ block: BlockOf<'listings'>; first?: boolean; anchor?: string; listings: Listing[]; total: number; watchdog: SiteForm | null; moreUrl: string | null }>()
const words = useSiteWords()
const w = words.value.cedule
const { filter, set } = useListingFilter()
const visible = computed(() => props.listings.filter((l) => listingMatches(l, filter.value)))
const chips = computed(() => {
  const counts = chipCounts(props.listings)
  return CHIPS.filter((c) => c.id === 'all' || counts[c.id]! > 0).map((c) => ({ ...c, count: counts[c.id]!, label: words.value.chips[c.id as keyof typeof words.value.chips] }))
})
const count = computed(() => (sameFilter(filter.value, NO_FILTER) ? w.shownAll(visible.value.length, props.total) : w.shownSome(visible.value.length)))
</script>

<template>
  <section :id="anchor" class="wrap pt-14 md:pt-20" :class="moreUrl ? '' : 'pb-16 md:pb-24'">
    <div class="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
      <!-- (the figure stands beside the heading, not in it: the heading is the words only) -->
      <div class="text-[3.2rem] md:text-[5rem] tracking-[-0.05em] leading-[0.9] font-extrabold">
        <component :is="first ? 'h1' : 'h2'" class="inline text-[3.2rem] md:text-[5rem] tracking-[-0.05em] leading-[0.9]"><KitMarked :text="block.heading" plain /></component><sup class="mono font-normal tracking-normal text-[0.9rem] md:text-[1rem] -top-[1.6em] md:-top-[2.6em] ml-2">{{ total }}</sup>
      </div>
      <UCarousel
        v-slot="{ item }" :items="chips" align="start" contain-scroll="trimSnaps" drag-free role="group" :aria-label="w.chipsLabel"
        :ui="{ root: 'lg:shrink-0', viewport: '-mx-5 px-5 md:mx-0 md:px-0', container: 'gap-2 pb-1 md:flex-wrap', item: 'basis-auto' }"
      >
        <button class="chip" type="button" :data-filter="item.id" :aria-pressed="sameFilter(filter, item.filter)" @click="set(item.filter)">{{ item.label }} <small>{{ item.count }}</small></button>
      </UCarousel>
    </div>

    <div class="sheet mt-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" data-grid>
      <CeduleCard v-for="l in visible" :key="l.id" :listing="l" />

      <!-- The cell that watches the offer -->
      <div v-if="watchdog && !watchdog.unavailable.value" class="on-dark bg-ink text-paper p-6 md:p-7 flex flex-col" data-cta :class="lastCellSpan(visible.length, { sm: 2, lg: 3, xl: 4 })">
        <p v-if="block.watchdogEyebrow" class="mono caps text-spark">{{ block.watchdogEyebrow }}</p>
        <h3 class="mt-3 text-[1.7rem] md:text-[1.9rem] leading-[1] max-w-[22rem]">{{ tidyText(block.watchdogHeading) }}</h3>
        <p v-if="watchdog.sent.value" class="mt-auto pt-6 font-bold" role="status">{{ block.watchdogSent || watchdog.successMessage.value }}</p>
        <form v-else :ref="watchdog.el" class="field mt-auto pt-6 flex flex-wrap gap-2 max-w-[32rem]" novalidate @submit.prevent="watchdog.submit">
          <label class="sr-only" :for="watchdog.id('email')">{{ w.watchdogLabel }}</label>
          <input :id="watchdog.id('email')" v-model="watchdog.values.email" class="flex-[1_1_12rem] !border-paper" type="email" name="email" :placeholder="w.watchdogPlaceholder" :aria-invalid="!!watchdog.errors.email">
          <button class="btn btn-brand flex-[1_1_auto]" type="submit" :disabled="watchdog.sending.value">{{ watchdog.sending.value ? words.sending : block.watchdogButton || watchdog.submitLabel.value }}</button>
          <KitFormExtras :form="watchdog" />
          <p v-if="watchdog.errors.email || watchdog.failure.value" class="basis-full field-error" role="alert">{{ watchdog.errors.email || watchdog.failure.value }}</p>
        </form>
      </div>
    </div>
    <p v-if="!visible.length" class="mt-6 font-medium" role="status">{{ w.nothing }}</p>

    <div class="mt-6 flex flex-wrap items-center justify-between gap-4">
      <p class="mono caps" data-count aria-live="polite">{{ count }}</p>
      <NuxtLink v-if="moreUrl" class="btn btn-ghost" :to="moreUrl">{{ w.all(total) }} <UIcon name="i-lucide-arrow-right" class="ic size-4" aria-hidden="true" /></NuxtLink>
    </div>
  </section>
</template>
