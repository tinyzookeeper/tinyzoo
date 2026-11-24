<script setup lang="ts">
// Čtvrthodinka's opening: "How much time do you have?" with three shelves to choose from (the
// articles outside the one chosen step back, and a line says how many are left lit) beside the
// lead article with the clock of its reading time on its photograph.
import type { Article } from '../../lib/cms-content'

const props = defineProps<{ block: BlockOf<'front'>; first?: boolean; articles: Article[] }>()
const { words } = await useBlog()
const shelf = useShelf()
const today = useToday()
const lead = computed(() => leadOf(props.articles))
const stats = computed(() => statsOf(props.articles))
const line = computed(() => {
  const counted = words.value.issued(words.value.stats(stats.value.count, hoursMinutes(stats.value.minutes)))
  return today.value ? `${words.value.today(today.value.weekday, today.value.day, today.value.month)} &nbsp;·&nbsp; ${counted}`.replace(/&nbsp;/g, ' ') : counted
})
const shelves = computed(() => SHELVES.map((s) => ({ ...s, label: words.value.shelves[s.key], count: shelfArticles(props.articles, s.key).length })))
const note = computed(() => {
  if (!shelf.chosen.value) return words.value.shelfIdle
  const lit = shelfArticles(props.articles, shelf.chosen.value)
  return words.value.shelfLit(shelf.chosen.value, lit.length, lit.reduce((sum, a) => sum + minutesOf(a), 0))
})
</script>

<template>
  <section class="wrap grid gap-x-12 gap-y-10 pb-16 pt-4 lg:grid-cols-12 lg:pb-24 lg:pt-6">
    <div class="lg:col-span-5 lg:pt-3">
      <p class="meta">{{ line }}</p>
      <h2 v-if="block.question" class="mt-4 text-[3.3rem] font-black leading-[0.94] tracking-[-0.045em] sm:text-[4.4rem] lg:mt-6 lg:text-[5.4rem]">{{ block.question }}</h2>

      <div class="mt-7 grid grid-cols-3 gap-2 lg:mt-9 lg:grid-cols-1 lg:gap-0" role="group" :aria-label="words.askLabel">
        <button
          v-for="(s, i) in shelves" :key="s.key" type="button" :data-time="s.key" :aria-pressed="shelf.chosen.value === s.key"
          class="time group flex cursor-pointer flex-col items-start gap-2 rounded-2xl bg-panel p-3 text-left transition-colors hover:bg-brand hover:text-brand-ink aria-pressed:bg-brand aria-pressed:text-brand-ink lg:flex-row lg:items-center lg:gap-5 lg:rounded-none lg:bg-transparent lg:px-3 lg:py-6"
          :class="i === 0 ? 'lg:border-t lg:border-rule' : i === shelves.length - 1 ? 'lg:border-y lg:border-rule' : 'lg:border-t lg:border-rule'"
          @click="shelf.toggle(s.key)"
        >
          <span class="dial [--size:2.2rem] group-hover:[--dial:var(--brand-ink)] group-hover:[--dial-ring:var(--brand-ink)] group-aria-pressed:[--dial:var(--brand-ink)] group-aria-pressed:[--dial-ring:var(--brand-ink)] lg:[--size:3.4rem]" :style="`--m:${s.key === '60' ? 45 : s.key}`" aria-hidden="true" />
          <span class="text-[1.02rem] font-extrabold leading-tight tracking-[-0.02em] lg:text-[2rem]">{{ s.label }}</span>
          <span class="text-[0.82rem] font-medium opacity-80 lg:ml-auto lg:text-[0.95rem]">{{ words.shelfCount(s.key, s.count) }}</span>
        </button>
      </div>
      <p class="meta mt-4 min-h-[1.4em]" aria-live="polite">{{ note }}</p>
    </div>

    <article v-if="lead" class="lg:col-span-7" :data-min="minutesOf(lead)" :class="{ 'is-dim': shelf.dim(minutesOf(lead)) }">
      <NuxtLink :to="articleHref(lead)" class="block" data-lead>
        <div class="relative">
          <div class="shot -mx-5 rounded-none sm:mx-0 sm:rounded-[1.25rem]"><CmsImage v-if="lead.image" :media="lead.image" eager sizes="(min-width: 1024px) 52rem, 100vw" class="aspect-[3/2] w-full object-cover lg:aspect-[2/1]" /></div>
          <p class="absolute -bottom-5 left-0 flex items-center gap-3 rounded-full bg-ground py-2 pl-2 pr-5 sm:left-5">
            <span class="dial" :style="`--m:${minutesOf(lead)}; --size:2.75rem`" aria-hidden="true" />
            <span class="text-[1.05rem] font-extrabold tracking-[-0.01em]">{{ words.minRead(minutesOf(lead)) }}</span>
          </p>
        </div>
        <p class="mt-10 flex items-center gap-3"><span class="tag">{{ lead.kind === 'column' ? words.column : lead.section.name }}</span><span class="meta">{{ block.leadLabel }}</span></p>
        <h2 class="head mt-4 text-[2.15rem] sm:text-[2.8rem] lg:text-[3.35rem]"><span class="lift">{{ tidyText(lead.title) }}</span></h2>
        <p v-if="lead.perex" class="stand mt-4 max-w-[44rem] text-[1.3rem] lg:text-[1.5rem]">{{ tidyText(lead.perex) }}</p>
        <p class="meta mt-5"><b>{{ lead.author.name }}</b> &nbsp;·&nbsp; {{ formatDate(lead.publishedAt) }}</p>
      </NuxtLink>
    </article>
  </section>
</template>
