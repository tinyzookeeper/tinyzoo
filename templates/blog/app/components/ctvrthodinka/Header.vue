<script setup lang="ts">
// Čtvrthodinka's bar: the name with its clock on the left, the sections as pills in the middle, the
// search and the subscribe button on the right. On a page that opens with the front page the name
// is the page's main heading. Below a desktop's width the menu folds behind a button.
const { settings, cta, about, words } = await useBlog()
const links = await useMenu()
const articles = await useArticles()
const frontFirst = await useFrontFirst()
const menu = useOverlayMenu()
const search = useSearchBox()
const searchInput = ref<HTMLInputElement | null>(null)
</script>

<template>
  <header class="wrap flex h-[4.5rem] items-center justify-between gap-6 lg:h-24">
    <NuxtLink to="/" class="flex h-11 items-center gap-3">
      <CtvrthodinkaWordmark :heading="frontFirst" marked />
      <span v-if="settings?.tagline" class="meta ml-2 hidden xl:inline">{{ settings.tagline }}</span>
    </NuxtLink>
    <nav :aria-label="words.sections" class="hidden lg:block">
      <ul class="flex items-center gap-1 text-[1rem] font-semibold">
        <li v-for="l in links" :key="l.id"><NuxtLink class="inline-flex h-11 items-center rounded-full px-4 transition-colors hover:bg-panel" :to="l.url" :target="l.newTab ? '_blank' : undefined">{{ l.label }}</NuxtLink></li>
      </ul>
    </nav>
    <div class="flex items-center gap-2">
      <form role="search" class="hidden h-11 items-center gap-2 rounded-full bg-panel pl-4 pr-2 lg:flex" @submit.prevent="search.submit">
        <UIcon name="i-lucide-search" class="text-lg text-quiet" aria-hidden="true" />
        <label for="q-header" class="sr-only">{{ words.searchLabel }}</label>
        <input id="q-header" v-model="search.q.value" type="search" name="q" :placeholder="words.searchShort" class="search-input w-28 bg-transparent text-[0.98rem] font-medium placeholder:text-quiet focus:outline-none xl:w-36">
      </form>
      <NuxtLink v-if="cta" :to="cta.url" class="hidden h-11 items-center rounded-full bg-brand px-5 text-[0.98rem] font-bold text-brand-ink transition-transform hover:-translate-y-0.5 lg:inline-flex">{{ cta.label }}</NuxtLink>
      <button type="button" class="inline-flex size-11 cursor-pointer items-center justify-center rounded-full bg-panel lg:hidden" :aria-label="words.openMenu" :aria-expanded="menu.open.value" aria-controls="site-menu" @click="menu.show(); nextTick(() => searchInput?.focus())"><UIcon name="i-lucide-menu" class="text-2xl" /></button>
    </div>

    <!-- Mobile menu -->
    <div v-show="menu.open.value" id="site-menu" class="fixed inset-0 z-50 overflow-y-auto bg-ground lg:hidden" role="dialog" aria-modal="true" :aria-label="words.menu">
      <div class="wrap flex min-h-full flex-col pb-8">
        <div class="flex h-[4.5rem] items-center justify-between">
          <CtvrthodinkaWordmark text="text-[1.9rem]" />
          <button type="button" class="inline-flex size-11 cursor-pointer items-center justify-center rounded-full bg-panel" :aria-label="words.closeMenu" @click="menu.hide()"><UIcon name="i-lucide-x" class="text-2xl" /></button>
        </div>
        <form role="search" class="mt-3 flex h-13 items-center gap-3 rounded-full bg-panel px-5" @submit.prevent="search.submit(); menu.hide()">
          <UIcon name="i-lucide-search" class="text-xl text-quiet" aria-hidden="true" />
          <label for="q-menu" class="sr-only">{{ words.searchLabel }}</label>
          <input id="q-menu" ref="searchInput" v-model="search.q.value" type="search" name="q" :placeholder="words.searchIn(articles.length)" class="search-input w-full bg-transparent text-lg font-medium placeholder:text-quiet focus:outline-none">
        </form>
        <nav :aria-label="words.sections" class="mt-6">
          <ul class="text-[2.3rem] font-extrabold leading-none tracking-[-0.03em]">
            <li v-for="(l, i) in links" :key="l.id"><NuxtLink class="flex items-baseline justify-between py-4" :class="i < links.length - 1 ? 'border-b border-rule' : ''" :to="l.url" @click="menu.hide()">{{ l.label }} <span v-if="l.count != null" class="meta">{{ l.count }}</span></NuxtLink></li>
          </ul>
        </nav>
        <div v-if="cta || about" class="mt-auto grid grid-cols-2 gap-3 pt-8">
          <NuxtLink v-if="cta" :to="cta.url" class="inline-flex h-13 items-center justify-center rounded-full bg-brand font-bold text-brand-ink" @click="menu.hide()">{{ cta.label }}</NuxtLink>
          <NuxtLink v-if="about" :to="about.url" class="inline-flex h-13 items-center justify-center rounded-full bg-panel font-bold" @click="menu.hide()">{{ about.label }}</NuxtLink>
        </div>
      </div>
    </div>
  </header>
</template>
