<script setup lang="ts">
// Sál's opening: the heading and the buttons on the left, a photograph of the hall on the
// right with a card over its corner that names the class that starts next (it needs the
// visitor's clock, so it appears once the page is mounted) and three short facts.
const props = defineProps<{ block: BlockOf<'hero'>; first?: boolean; slots: Slot[] }>()
const { words } = await useStudio()
const photo = computed(() => heroPhotos(props.block, 'sal').main)
const tt = useTimetable(() => props.slots)
const next = computed(() => nextLesson(props.slots, tt.week.value?.dates, tt.now.value))
const when = computed(() => {
  if (!next.value) return ''
  const { days, slot } = next.value
  return `${words.value.nextLesson} · ${days === 0 ? words.value.today : days === 1 ? words.value.tomorrow : words.value.days[slot.dayIndex]!.long.toLowerCase()}`
})
// The heading's size steps down for a longer one; the design's own wording is the first step.
const size = computed(() => byLength(props.block.heading, [[64, 'text-[clamp(2.6rem,5.4vw,4.6rem)]'], [100, 'text-[clamp(2.2rem,4.4vw,3.6rem)]']], 'text-[clamp(1.9rem,3.6vw,3rem)]'))
</script>

<template>
  <section class="wrap pt-6 pb-16 md:pt-10 md:pb-24">
    <div class="grid lg:grid-cols-12 gap-x-12 gap-y-10 items-center">
      <div class="lg:col-span-6">
        <p v-if="block.eyebrow" class="label">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="mt-5 leading-[1.04]" :class="size"><KitMarked :text="block.heading" /></component>
        <p v-if="block.text" class="mt-6 max-w-[34rem] text-[1.15rem] leading-[1.6]">{{ tidyText(block.text) }}</p>
        <div class="mt-8 flex flex-wrap items-center gap-x-7 gap-y-3">
          <NuxtLink v-if="block.primaryLabel && block.primaryUrl" class="btn" :to="siteHref(block.primaryUrl)">{{ block.primaryLabel }}</NuxtLink>
          <NuxtLink v-if="block.secondaryLabel && block.secondaryUrl" class="tlink" :to="siteHref(block.secondaryUrl)">{{ block.secondaryLabel }} <UIcon name="i-lucide-arrow-down" class="size-[1em]" aria-hidden="true" /></NuxtLink>
        </div>
        <ul v-if="block.facts.length" class="mt-10 pt-6 border-t border-line grid grid-cols-3 gap-4 max-w-[34rem] text-[0.95rem] leading-snug text-ink">
          <li v-for="fact in block.facts" :key="fact.id">{{ fact.label }} <span v-if="fact.value" class="block text-quiet">{{ fact.value }}</span></li>
        </ul>
      </div>
      <div class="lg:col-span-6 relative">
        <div v-if="photo" class="ph aspect-[4/5] sm:aspect-[4/3] lg:aspect-[5/6] !rounded-[2rem]">
          <CmsImage :media="photo" eager sizes="(min-width: 1024px) 40rem, 100vw" />
        </div>
        <!-- The next class: filled from the timetable once the clock is known -->
        <a v-if="next" :href="`#${anchorOf('timetable')}`" class="absolute left-3 right-3 bottom-3 sm:left-auto sm:right-5 sm:bottom-5 sm:w-[19.5rem] lg:right-auto lg:-left-10 lg:bottom-10 block p-5 rounded-3xl bg-card text-body shadow-[0_18px_40px_-18px_rgba(20,35,30,.45)] transition-transform hover:-translate-y-0.5" data-next @click="tt.setDay(next.slot.day)">
          <span class="label flex items-center gap-2"><span class="w-1.5 h-1.5 rounded-full bg-warm" /><span>{{ when }}</span></span>
          <span class="mt-2 block font-display text-[1.6rem] leading-[1.1] text-ink">{{ tidyText(next.slot.title) }}</span>
          <span class="mt-1.5 block text-[0.95rem] leading-snug">{{ next.slot.start }}–{{ next.slot.end }} · {{ next.slot.first }} {{ next.slot.last }} · {{ next.slot.room }}</span>
          <span class="mt-3 flex items-center justify-between text-[0.9rem] font-semibold text-brand"><span>{{ words.freeLong(next.slot.free) }}</span><UIcon name="i-lucide-arrow-right" class="size-[1em]" aria-hidden="true" /></span>
        </a>
      </div>
    </div>
  </section>
</template>
