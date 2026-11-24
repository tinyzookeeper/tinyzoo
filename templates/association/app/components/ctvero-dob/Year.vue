<script setup lang="ts">
// Čtvero dob's year: the strip of twelve months (each in the tint of its season, the current one
// in the brand colour; on a phone a row to swipe that starts at it), then the projects as large
// cards in their season's tint, staggered in two columns, the last cell a note.
import type { Project } from '~/lib/cms-content'

defineProps<{ block: BlockOf<'year'>; first?: boolean; anchor?: string; projects: Project[] }>()
const { settings, words, month } = await useAssociation()
const months = computed(() => words.value.months.map((name, i) => ({ name, text: settings.value?.months?.[i]?.text ?? '', season: seasonOfMonth(i + 1) })))
const tint = (p: Project) => { const s = projectSeason(p.season); return s ? TINT[s] : 'bg-sand' }
const chip = (p: Project) => [p.season && p.season !== 'year' ? words.value.seasons[projectSeason(p.season)!] : '', p.period].filter(Boolean).join(' · ')
</script>

<template>
  <section :id="anchor" class="scroll-mt-6 pb-24 md:pb-36" :class="first ? 'pt-[calc(80px+5rem)] md:pt-[calc(80px+7rem)]' : 'pt-20 md:pt-28'">
    <div class="wrap">
      <div class="grid gap-6 lg:grid-cols-12 lg:items-end">
        <component :is="first ? 'h1' : 'h2'" class="h2 lg:col-span-7"><KitMarked :text="block.heading" /></component>
        <p v-if="block.text" class="text-[1.1rem] lg:col-span-5">{{ tidy(block.text) }}</p>
      </div>
    </div>

    <!-- Twelve months -->
    <div class="wrap mt-10 max-lg:!px-0">
      <UCarousel
        v-slot="{ item, index }" :items="months" align="center" drag-free :start-index="month - 1"
        :breakpoints="{ '(min-width: 1024px)': { active: false } }"
        :ui="{ viewport: 'px-5 pb-1 md:px-10 lg:px-0', container: '-ms-2 items-stretch', item: 'basis-auto ps-2 lg:basis-1/12' }"
      >
        <div class="h-full w-[106px] rounded-[18px] p-3 lg:w-full" :class="index === month - 1 ? 'bg-brand text-brand-ink' : [TINT[item.season], 'text-ink']" :aria-current="index === month - 1 ? 'date' : undefined" :data-month-now="index === month - 1 ? '' : undefined">
          <p class="serif text-[1.15rem] font-semibold italic leading-none">{{ item.name }}</p>
          <p class="mt-6 text-[0.86rem] leading-[1.25]">{{ item.text }} <span v-if="index === month - 1" class="mt-1 block font-semibold text-podzim">{{ words.rightNow }}</span></p>
        </div>
      </UCarousel>
    </div>

    <div v-if="projects.length || block.asideHeading" class="wrap mt-12 md:mt-16">
      <div class="grid gap-6 md:grid-cols-2 md:gap-8">
        <article v-for="(p, i) in projects" :key="p.id" class="rounded-[28px] p-4 sm:p-5" :class="[tint(p), i % 2 ? 'md:translate-y-16' : '']">
          <CmsImage v-if="p.photo" :media="p.photo" sizes="(min-width: 768px) 38rem, 100vw" class="aspect-[16/10] w-full rounded-[18px] object-cover" />
          <div class="px-2 pb-2 pt-5 sm:px-3">
            <p v-if="chip(p)" class="chip">{{ chip(p) }}</p>
            <h3 class="mt-3 text-[clamp(1.7rem,2.6vw,2.2rem)]">{{ p.title }}</h3>
            <p v-if="p.text" class="mt-2 text-ink">{{ tidy(p.text) }}</p>
            <p v-if="p.result" class="mt-4 rounded-[16px] bg-paper p-4 leading-snug text-ink"><em class="serif mr-1 text-[1.1rem] font-semibold">{{ words.thisYear }}</em> <strong class="font-semibold">{{ tidy(p.result) }}</strong></p>
          </div>
        </article>
        <aside v-if="block.asideHeading" class="flex flex-col justify-end rounded-[28px] bg-sand p-7 sm:p-9" :class="projects.length % 2 ? 'md:translate-y-16' : ''">
          <p class="serif text-[clamp(1.7rem,2.6vw,2.2rem)] font-bold leading-[1.1] text-ink"><KitMarked :text="block.asideHeading" :attrs="{ class: 'font-semibold' }" /></p>
          <p v-if="block.asideText" class="mt-3 text-ink">{{ tidy(block.asideText) }}</p>
          <NuxtLink v-if="block.asideLinkLabel && block.asideLinkUrl" class="u mt-5 inline-flex min-h-[44px] items-center gap-2" :to="siteHref(block.asideLinkUrl)">{{ block.asideLinkLabel }} <UIcon name="i-lucide-arrow-right" class="size-[1em]" aria-hidden="true" /></NuxtLink>
        </aside>
      </div>
    </div>
  </section>
</template>
