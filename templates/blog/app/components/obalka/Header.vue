<script setup lang="ts">
// Obálka's bar: the sections on the left, the search and the newsletter button on the right.
// On a page that opens with the front page it lies over the cover photograph (white, the
// cover's name stands under it); on every other page it stands on the paper with the name on
// its left. Below a desktop's width the menu folds behind a button.
const { name, cta, about, words } = await useBlog()
const links = await useMenu()
const articles = await useArticles()
const over = await useFrontFirst()
const menu = useOverlayMenu()
const search = useSearchBox()
const searchInput = ref<HTMLInputElement | null>(null)
const today = useToday()
const week = computed(() => (today.value ? isoWeek(today.value) : null))
const openMenu = () => { menu.show(); nextTick(() => searchInput.value?.focus()) }
</script>

<template>
  <header :class="over ? 'absolute inset-x-0 top-0 z-20 text-white' : 'border-b border-line'">
    <div class="wrap flex h-16 items-center justify-between gap-6">
      <NuxtLink v-if="!over" to="/" class="font-display text-[1.75rem] font-light leading-none tracking-[-0.02em] inline-flex min-h-11 items-center lg:mr-2" :aria-label="name"><ObalkaWordmark /></NuxtLink>
      <nav :aria-label="words.sections" class="hidden lg:block lg:flex-1">
        <ul class="flex items-center gap-7 text-[0.95rem]">
          <li v-for="l in links" :key="l.id"><NuxtLink class="lift py-3" :class="l.italic ? 'italic' : ''" :to="l.url" :target="l.newTab ? '_blank' : undefined">{{ l.label }}</NuxtLink></li>
        </ul>
      </nav>
      <p v-if="over" class="kicker lg:hidden"><template v-if="week">{{ words.week(week) }}</template></p>
      <div class="flex items-center gap-2 lg:gap-6">
        <form role="search" class="hidden items-center gap-2 border-b pb-1 lg:flex" :class="over ? 'border-white/50 focus-within:border-white' : 'border-ink/40 focus-within:border-ink'" @submit.prevent="search.submit">
          <UIcon name="i-lucide-search" class="text-base" aria-hidden="true" />
          <label for="q-header" class="sr-only">{{ words.searchLabel }}</label>
          <input id="q-header" v-model="search.q.value" type="search" name="q" :placeholder="words.searchIn(articles.length)" class="search-input w-44 bg-transparent text-[0.95rem] focus:outline-none" :class="over ? 'text-white placeholder:text-white/75' : 'text-ink placeholder:text-quiet'">
        </form>
        <NuxtLink v-if="cta" :to="cta.url" class="hidden h-10 items-center border px-4 text-[0.95rem] transition-colors lg:inline-flex" :class="over ? 'border-white/70 hover:bg-white hover:text-ink' : 'border-ink/60 hover:bg-ink hover:text-paper'">{{ cta.label }}</NuxtLink>
        <button type="button" class="inline-flex size-11 items-center justify-center lg:hidden" :aria-label="words.searchLabel" aria-controls="site-menu" :aria-expanded="menu.open.value" @click="openMenu"><UIcon name="i-lucide-search" class="text-xl" /></button>
        <button type="button" class="-mr-2 inline-flex size-11 items-center justify-center lg:hidden" :aria-label="words.openMenu" :aria-expanded="menu.open.value" aria-controls="site-menu" @click="menu.show()"><UIcon name="i-lucide-menu" class="text-2xl" /></button>
      </div>
    </div>

    <!-- Mobile menu -->
    <div v-show="menu.open.value" id="site-menu" class="fixed inset-0 z-50 overflow-y-auto bg-paper text-ink lg:hidden" role="dialog" aria-modal="true" :aria-label="words.menu">
      <div class="wrap flex min-h-full flex-col pb-10">
        <div class="flex h-16 items-center justify-between">
          <p class="font-display text-3xl font-light tracking-[-0.02em]"><ObalkaWordmark /></p>
          <button type="button" class="-mr-2 inline-flex size-11 items-center justify-center" :aria-label="words.closeMenu" @click="menu.hide()"><UIcon name="i-lucide-x" class="text-2xl" /></button>
        </div>
        <form role="search" class="mt-4 flex items-center gap-3 border-b border-ink pb-2" @submit.prevent="search.submit(); menu.hide()">
          <UIcon name="i-lucide-search" class="text-xl" aria-hidden="true" />
          <label for="q-menu" class="sr-only">{{ words.searchLabel }}</label>
          <input id="q-menu" ref="searchInput" v-model="search.q.value" type="search" name="q" :placeholder="words.searchIn(articles.length)" class="search-input h-11 w-full bg-transparent text-lg placeholder:text-quiet focus:outline-none">
        </form>
        <nav :aria-label="words.sections" class="mt-6">
          <ul class="divide-y divide-line font-display text-[2rem] font-light">
            <li v-for="l in links" :key="l.id"><NuxtLink class="flex items-baseline justify-between py-3" :class="l.italic ? 'italic' : ''" :to="l.url" @click="menu.hide()">{{ l.label }} <span v-if="l.count != null" class="byline text-quiet" :class="l.italic ? 'not-italic' : ''">{{ l.count }}</span></NuxtLink></li>
          </ul>
        </nav>
        <div v-if="cta || about" class="mt-auto grid grid-cols-2 gap-3 pt-10">
          <NuxtLink v-if="cta" :to="cta.url" class="inline-flex h-12 items-center justify-center bg-brand px-4 text-brand-ink" @click="menu.hide()">{{ cta.label }}</NuxtLink>
          <NuxtLink v-if="about" :to="about.url" class="inline-flex h-12 items-center justify-center border border-ink px-4" @click="menu.hide()">{{ about.label }}</NuxtLink>
        </div>
      </div>
    </div>
  </header>
</template>
