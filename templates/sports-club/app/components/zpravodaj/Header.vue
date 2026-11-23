<script setup lang="ts">
// Zpravodaj's masthead: a line in the club colour with the next match and the club's place, the
// crest and name, the menu and the membership button. Below a desktop's width the menu folds
// behind a button and drops down under the masthead.
const now = useNow()
const { nav, name } = await useSite()
const { cta, words } = await useClub()
const links = computed(() => menuLinks(nav.value?.main))
const menu = useOverlayMenu()
const next = await useNextMatch(now)
const table = await useTable()
const competition = computed(() => next.value.squad?.competition)
const ours = computed(() => table.value.ours)
</script>

<template>
  <div v-if="next.match || ours" class="on-brand bg-brand text-brand-ink">
    <div class="wrap flex min-h-10 items-center justify-between gap-6 py-2 text-[13px] leading-snug">
      <p v-if="next.match"><span class="font-semibold text-second">{{ words.nextMatchColon }}</span> {{ weekday(next.match.at) }} {{ dayMonth(next.match.at) }} {{ words.at(next.match.time) }}, {{ next.match.home.name }} – {{ next.match.away.name }}</p>
      <p v-if="ours" class="hidden md:block">{{ competition }} · <span class="font-semibold text-second">{{ words.place(ours.place) }}</span> {{ words.afterRounds(ours.row.played) }}</p>
    </div>
  </div>

  <header class="border-b border-line">
    <div class="wrap flex items-center justify-between gap-6 py-5">
      <NuxtLink to="/" :aria-label="words.homeOf(name)"><ZpravodajWordmark tagline /></NuxtLink>
      <nav class="hidden items-center gap-8 text-[15px] font-medium text-ink lg:flex" :aria-label="words.mainMenu">
        <NuxtLink v-for="l in links" :key="l.id" class="py-3 hover:text-brand" :to="l.url" :target="l.newTab ? '_blank' : undefined">{{ l.label }}</NuxtLink>
        <NuxtLink v-if="cta" class="btn btn-line !min-h-11" :to="cta.url">{{ cta.label }}</NuxtLink>
      </nav>
      <button type="button" class="inline-flex h-12 cursor-pointer items-center gap-2 border border-ink px-4 text-[15px] font-semibold text-ink lg:hidden" :aria-expanded="menu.open.value" aria-controls="site-menu" @click="menu.open.value ? menu.hide() : menu.show()">
        <UIcon name="i-lucide-menu" class="text-xl" aria-hidden="true" /> {{ words.menu }}
      </button>
    </div>
    <nav v-show="menu.open.value" id="site-menu" class="border-t border-line bg-tint lg:hidden" :aria-label="words.mobileMenu">
      <div class="wrap flex flex-col py-3 font-display text-xl font-semibold text-ink">
        <NuxtLink v-for="l in links" :key="l.id" class="flex min-h-12 items-center border-b border-line" :to="l.url" @click="menu.hide()">{{ l.label }}</NuxtLink>
        <NuxtLink v-if="cta" class="flex min-h-12 items-center" :to="cta.url" @click="menu.hide()">{{ cta.label }}</NuxtLink>
      </div>
    </nav>
  </header>
</template>
