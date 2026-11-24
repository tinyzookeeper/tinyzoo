<script setup lang="ts">
// Tabule's opening, all in the studio's colour: the heading in capitals across the whole
// width, the words and the buttons, the classes of today as a small board (today, or tomorrow
// once the last class has begun: it needs the visitor's clock, so it is filled in once the page
// is mounted) and a photograph printed in the colour of the site instead of black.
const props = defineProps<{ block: BlockOf<'hero'>; first?: boolean; slots: Slot[] }>()
const { words } = await useStudio()
const photo = computed(() => heroPhotos(props.block, 'tabule').main)
const { now, week } = useWeek()
const board = computed(() => (now.value && week.value ? boardOf(props.slots, week.value, now.value) : null))
const heading = computed(() => linesOf(props.block.heading))
// The heading's size follows its longest line; the design's own wording is the first step.
const size = computed(() => byLength(heading.value.reduce((a, l) => (l.length > a.length ? l : a), ''), [[8, 'text-[clamp(2.4rem,12vw,11.4rem)]'], [12, 'text-[clamp(2.2rem,8vw,7.6rem)]'], [18, 'text-[clamp(2rem,5.6vw,5.2rem)]']], 'text-[clamp(1.7rem,4vw,3.8rem)]'))
const label = computed(() => {
  if (!board.value) return words.value.today
  const { when, date, dayIndex } = board.value
  return `${when === 'today' ? words.value.today : when === 'tomorrow' ? words.value.tomorrowCap : words.value.onMonday} · ${when === 'monday' ? '' : `${words.value.days[dayIndex]!.long.toLowerCase()} `}${dayMonth(date)}`
})
</script>

<template>
  <section class="on-brand bg-brand text-brand-ink overflow-hidden">
    <div class="wrap pt-8 lg:pt-10">
      <p v-if="block.eyebrow" class="mono">{{ block.eyebrow }}</p>
      <component :is="first ? 'h1' : 'h2'" class="display mt-3 lg:mt-4 leading-[0.93] whitespace-nowrap" :class="size"><template v-for="(line, i) in heading" :key="i"><br v-if="i"><KitMarked :text="line" plain /></template></component>
      <div class="mt-8 lg:mt-10 grid lg:grid-cols-12 gap-x-10 gap-y-10">
        <div class="lg:col-span-4 flex flex-col lg:justify-end lg:pb-12">
          <p v-if="block.text" class="text-[1.2rem] leading-[1.45] max-w-[26rem]">{{ tidyText(block.text) }}</p>
          <div class="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
            <NuxtLink v-if="block.primaryLabel && block.primaryUrl" class="btn" :to="siteHref(block.primaryUrl)">{{ block.primaryLabel }} <UIcon name="i-lucide-arrow-right" class="ico size-[1em]" aria-hidden="true" /></NuxtLink>
            <NuxtLink v-if="block.secondaryLabel && block.secondaryUrl" class="ulink mono" :to="siteHref(block.secondaryUrl)">{{ block.secondaryLabel }}</NuxtLink>
          </div>
        </div>

        <!-- Today: filled from the timetable -->
        <aside class="lg:col-span-4 lg:pb-10" :aria-label="words.todaysClasses">
          <p class="mono flex justify-between pb-3 border-b-2 border-brand-ink"><span data-today-label>{{ label }}</span><span>{{ board ? words.lessonsCount(board.slots.length) : '' }}</span></p>
          <ul class="text-[1rem]" data-today>
            <li v-for="s in board?.slots ?? []" :key="s.id">
              <a :href="`#${anchorOf('signup')}`" class="grid grid-cols-[3.6rem_1fr_auto] items-baseline gap-3 min-h-[44px] py-2 border-b border-brand-ink/30 transition-colors hover:text-accent" :class="board?.when === 'today' && s.startMin < board.nowMin ? 'opacity-60' : ''" @click="pickSlot(s)">
                <span class="font-mono text-accent">{{ s.start }}</span><span class="font-display font-bold tracking-[-0.01em] leading-tight">{{ tidyText(s.title) }}</span>
                <span class="mono !text-[0.75rem]">{{ s.free === 0 ? words.fullLower : words.freeBoard(s.free) }}</span>
              </a>
            </li>
          </ul>
          <a class="ulink mono mt-2" :href="`#${anchorOf('timetable')}`">{{ words.wholeTimetable }} <UIcon name="i-lucide-arrow-down" class="size-[1em]" aria-hidden="true" /></a>
        </aside>

        <div v-if="photo" class="duo bleed-r lg:col-span-4 aspect-[4/3] lg:aspect-auto lg:min-h-[23rem]">
          <CmsImage :media="photo" eager sizes="(min-width: 1024px) 40rem, 100vw" class="object-[66%_50%] lg:absolute lg:inset-0" />
        </div>
      </div>
    </div>
  </section>
</template>
