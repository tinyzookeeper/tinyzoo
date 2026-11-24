<script setup lang="ts">
// Deka's kinds of classes: photograph cards with a name tag in the kind's thread colour, and a
// sixth card for those who cannot choose. On a phone a row to swipe, on a tablet two columns,
// on a desktop three.
import type { LessonKind } from '../../lib/cms-content'

const props = defineProps<{ block: BlockOf<'kinds'>; first?: boolean; anchor?: string; kinds: LessonKind[]; slots: Slot[] }>()
const { words } = await useStudio()
const tt = useTimetable(() => props.slots)
const countOf = (k: LessonKind) => props.slots.filter((s) => s.kindId === k.id).length
const show = (k: LessonKind) => { tt.showKind(k.id); showTimetable() }
const hasHelp = computed(() => !!(props.block.helpTitle || props.block.helpText))
// The cards of the row: the kinds, and the help card after them.
const cards = computed<Array<LessonKind | { help: true }>>(() => [...props.kinds, ...(hasHelp.value ? [{ help: true as const }] : [])])
</script>

<template>
  <section :id="anchor" class="wrap py-16 md:py-24">
    <div class="grid lg:grid-cols-12 gap-x-10 gap-y-4 items-end">
      <component :is="first ? 'h1' : 'h2'" class="h2 lg:col-span-7"><KitMarked :text="block.heading" /></component>
      <p v-if="block.text" class="lg:col-span-5">{{ tidyText(block.text) }}</p>
    </div>
    <div class="mt-10 -mx-5 md:mx-0">
      <UCarousel
        v-slot="{ item }" :items="cards" align="start" contain-scroll="trimSnaps" :breakpoints="{ '(min-width: 768px)': { active: false } }"
        :ui="{ viewport: 'px-5 md:px-0', container: 'items-stretch -ms-4 md:-ms-6 md:flex-wrap md:-mb-10', item: 'basis-[79%] ps-4 md:basis-1/2 lg:basis-1/3 md:ps-6 md:mb-10' }"
      >
        <aside v-if="'help' in item" class="flex flex-col justify-between p-7 rounded-md bg-brand text-brand-ink h-full">
          <div>
            <p class="font-display font-bold text-[1.9rem] leading-[1.1]">{{ block.helpTitle }}</p>
            <p v-if="block.helpText" class="mt-3">{{ tidyText(block.helpText) }}</p>
          </div>
          <NuxtLink v-if="block.helpLabel && block.helpUrl" class="btn mt-6 self-start hover:!bg-paper hover:!text-ink" :to="siteHref(block.helpUrl)">{{ block.helpLabel }}</NuxtLink>
        </aside>
        <article v-else class="flex flex-col" :class="`th${threadOf(kinds.indexOf(item))}`">
          <div class="relative">
            <div class="ph aspect-[4/3]"><CmsImage v-if="item.image" :media="item.image" sizes="(min-width: 1024px) 25rem, (min-width: 768px) 50vw, 78vw" /></div>
            <h3 class="absolute left-3 -bottom-4 px-3.5 py-1.5 rounded-md bg-[var(--k)] text-[1.5rem] leading-tight shadow-[0_0_0_4px_var(--paper)]">{{ tidyText(item.name) }}</h3>
          </div>
          <p class="mt-8">{{ tidyText(item.summary) }}</p>
          <dl class="mt-4 pt-4 border-t border-[var(--rule)] grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-1.5 text-[0.925rem] leading-snug">
            <dt class="text-quiet">{{ words.forWhom }}</dt><dd class="text-ink">{{ item.audience }}</dd>
            <dt class="text-quiet">{{ words.level }}</dt><dd class="text-ink">{{ item.levelNote }}</dd>
            <dt class="text-quiet">{{ words.length }}</dt><dd class="text-ink">{{ item.duration }}</dd>
          </dl>
          <button type="button" class="tlink mt-2 self-start cursor-pointer" data-kind-link @click="show(item)">{{ words.lessonsInTimetable(countOf(item)) }}</button>
        </article>
      </UCarousel>
    </div>
  </section>
</template>
