<script setup lang="ts">
// Katastr's listings: a heading over a rule with the filter chips beside it (a row to swipe on a
// phone), three columns of cards, the box that watches the offer filling the last row, and a
// count with a link to the whole offer. The chips and the search of the opening set one filter.
import type { Listing } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'listings'>; first?: boolean; anchor?: string; listings: Listing[]; total: number; watchdog: SiteForm | null; moreUrl: string | null }>()
const words = useSiteWords()
const w = words.value.katastr
const { filter, set } = useListingFilter()
const visible = computed(() => props.listings.filter((l) => listingMatches(l, filter.value)))
const chips = computed(() => {
  const counts = chipCounts(props.listings)
  return CHIPS.filter((c) => c.id === 'all' || counts[c.id]! > 0).map((c) => ({ ...c, count: counts[c.id]!, label: words.value.chips[c.id as keyof typeof words.value.chips] }))
})
const count = computed(() => (sameFilter(filter.value, NO_FILTER) ? w.shownAll(visible.value.length, props.total) : w.shownSome(visible.value.length)))
</script>

<template>
  <section :id="anchor" class="wrap pt-20 md:pt-28" :class="moreUrl ? '' : 'pb-16 md:pb-24'">
    <div class="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 pb-8 border-b border-ink">
      <div>
        <p v-if="block.eyebrow" class="label text-brand">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="mt-3 text-[2.1rem] md:text-[2.75rem] leading-[1.1]"><KitMarked :text="block.heading" /></component>
      </div>
      <UCarousel
        v-slot="{ item }" :items="chips" align="start" contain-scroll="trimSnaps" drag-free role="group" :aria-label="w.chipsLabel"
        :ui="{ root: 'lg:shrink-0', viewport: '-mx-5 px-5 md:mx-0 md:px-0', container: 'gap-2 pb-1 md:flex-wrap lg:flex-nowrap', item: 'basis-auto' }"
      >
        <button class="chip" type="button" :data-filter="item.id" :aria-pressed="sameFilter(filter, item.filter)" @click="set(item.filter)">{{ item.label }} <small>{{ item.count }}</small></button>
      </UCarousel>
    </div>

    <div class="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12 md:gap-y-14" data-grid>
      <KatastrCard v-for="l in visible" :key="l.id" :listing="l" />

      <!-- The box that watches the offer -->
      <div v-if="watchdog && !watchdog.unavailable.value" class="bg-tint p-7 md:p-9 flex flex-col justify-center" data-cta :class="lastCellSpan(visible.length, { sm: 2, lg: 3 })">
        <p v-if="block.watchdogEyebrow" class="label text-brand">{{ block.watchdogEyebrow }}</p>
        <h3 class="mt-3 text-[1.55rem] leading-[1.2] max-w-[26rem]">{{ tidyText(block.watchdogHeading) }}</h3>
        <p v-if="watchdog.sent.value" class="mt-6 text-ink" role="status">{{ block.watchdogSent || watchdog.successMessage.value }}</p>
        <form v-else :ref="watchdog.el" class="field mt-6 flex flex-wrap gap-3 max-w-[34rem]" novalidate @submit.prevent="watchdog.submit">
          <label class="sr-only" :for="watchdog.id('email')">{{ w.watchdogLabel }}</label>
          <input :id="watchdog.id('email')" v-model="watchdog.values.email" class="flex-[1_1_14rem]" type="email" name="email" :placeholder="w.watchdogPlaceholder" :aria-invalid="!!watchdog.errors.email">
          <button class="btn flex-[0_0_auto]" type="submit" :disabled="watchdog.sending.value">{{ watchdog.sending.value ? words.sending : block.watchdogButton || watchdog.submitLabel.value }}</button>
          <KitFormExtras :form="watchdog" />
          <p v-if="watchdog.errors.email || watchdog.failure.value" class="basis-full field-error" role="alert">{{ watchdog.errors.email || watchdog.failure.value }}</p>
        </form>
        <p v-if="block.watchdogText && !watchdog.sent.value" class="mt-3 text-[0.88rem] text-quiet">{{ tidyText(block.watchdogText) }}</p>
      </div>
    </div>
    <p v-if="!visible.length" class="mt-10 text-quiet" role="status">{{ w.nothing }}</p>

    <div class="mt-10 pt-6 border-t border-line flex flex-wrap items-center justify-between gap-4">
      <p class="text-quiet" data-count aria-live="polite">{{ count }}</p>
      <NuxtLink v-if="moreUrl" class="tlink" :to="moreUrl">{{ w.all(total) }} <UIcon name="i-lucide-arrow-right" class="ic" aria-hidden="true" /></NuxtLink>
    </div>
  </section>
</template>
