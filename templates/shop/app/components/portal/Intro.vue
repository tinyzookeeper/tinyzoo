<script setup lang="ts">
// Portál's opening: the shop window beside the door, the door's hanging "Open" sign, and under
// the window three panels of the joinery (today's hours, the address, the phone). The sign and
// the hours are the visitor's clock's: they appear once the page is drawn in the browser.
defineProps<{ block: BlockOf<'intro'>; first?: boolean }>()
const { settings, words, week, place, lines } = await useShop()
const opening = useOpening(week)
const state = computed(() => (opening.value ? (opening.value.open ? 'open' : 'closed') : 'unknown'))
</script>

<template>
  <section class="wrap pt-6 md:pt-8">
    <div class="grid gap-4 lg:grid-cols-12 lg:gap-5">
      <div class="frame relative order-2 lg:order-1 lg:col-span-7">
        <div class="relative h-full">
          <CmsImage v-if="block.image" :media="block.image" eager sizes="(min-width: 1024px) 46rem, 100vw" class="aspect-[4/3] h-full w-full object-cover lg:aspect-auto lg:min-h-[30rem]" />
          <div class="glazing" />
        </div>
      </div>
      <div class="panel order-1 flex flex-col justify-center px-6 pb-9 pt-9 md:px-11 md:pb-11 lg:order-2 lg:col-span-5">
        <div class="relative self-start pt-8">
          <svg class="absolute left-0 top-0 h-8 w-full text-cream/60" viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true"><path d="M14 33 49 4 88 29" fill="none" stroke="currentColor" stroke-width="1.5" vector-effect="non-scaling-stroke" /></svg>
          <span class="absolute left-[49%] top-0 size-2 -translate-x-1/2 rounded-full bg-brass" />
          <p class="sign" :data-state="state" data-open-sign>
            <span class="sign-word">{{ state === 'closed' ? words.closed : words.open }}</span>
            <span class="mt-1 text-[0.82rem] font-medium">{{ opening ? words.openDetail(opening.detail) : '\u00A0' }}</span>
          </p>
        </div>
        <component :is="first ? 'h1' : 'h2'" class="mt-8 text-[2.3rem] md:text-[2.9rem]"><KitMarked :text="block.heading" /></component>
        <p class="mt-5 max-w-[34rem] text-cream/85">{{ tidyText(block.text) }}</p>
        <div class="mt-8 flex flex-wrap gap-3">
          <NuxtLink v-if="block.primaryLabel" :to="siteHref(block.primaryUrl)" class="btn" v-bind="linkAttrs(block.primaryUrl)">{{ block.primaryLabel }}</NuxtLink>
          <NuxtLink v-if="block.secondaryLabel" :to="siteHref(block.secondaryUrl)" class="btn btn-line" v-bind="linkAttrs(block.secondaryUrl)">{{ block.secondaryLabel }}</NuxtLink>
        </div>
      </div>
    </div>
    <!-- the stall riser: three panels under the window -->
    <div class="mt-4 grid gap-4 md:grid-cols-3 lg:mt-5 lg:gap-5">
      <div class="panel px-6 py-6 md:px-8">
        <p class="caps text-brass" :data-state="opening ? 'known' : 'unknown'">{{ words.today }}, <span>{{ opening ? `${words.daysLower[opening.day]} ${opening.date}` : '\u00A0' }}</span></p>
        <p class="fig mt-2 text-[1.7rem] leading-tight" :data-state="opening ? 'known' : 'unknown'" data-today-hours>{{ opening ? dayText(opening.today, words.closedDay) : '\u00A0' }}</p>
        <p class="mt-1 text-[0.95rem] text-cream/75">{{ lines.join(', ') }}</p>
      </div>
      <div class="panel px-6 py-6 md:px-8">
        <p class="caps text-brass">{{ words.address }}</p>
        <p class="fig mt-2 text-[1.7rem] leading-tight">{{ place }}</p>
        <p v-if="settings?.locationNote" class="mt-1 text-[0.95rem] text-cream/75">{{ tidyText(settings.locationNote) }}</p>
      </div>
      <div class="panel px-6 py-6 md:px-8">
        <p class="caps text-brass">{{ words.portal.phone }}</p>
        <p class="fig mt-2 text-[1.7rem] leading-tight"><a v-if="settings?.phone" :href="phoneHref(settings.phone)" class="transition-colors hover:text-brass">{{ settings.phone }}</a></p>
        <p v-if="block.phoneNote" class="mt-1 text-[0.95rem] text-cream/75">{{ tidyText(block.phoneNote) }}</p>
      </div>
    </div>
  </section>
</template>
