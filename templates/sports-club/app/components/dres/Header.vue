<script setup lang="ts">
// Dres's masthead: a band of the club colour with shirt stripes, the mark on the left, the menu
// and a black button on the right. The next match opens right under it on the same colour.
// Below a desktop's width the menu is a black sheet over the whole page.
const { nav, name } = await useSite()
const { cta, words } = await useClub()
const links = computed(() => menuLinks(nav.value?.main))
const menu = useOverlayMenu()
</script>

<template>
  <header class="stripes bg-brand text-brand-ink">
    <div class="wrap flex items-center justify-between gap-6 py-5">
      <NuxtLink to="/" class="min-w-0" :aria-label="words.homeOf(name)"><DresWordmark /></NuxtLink>
      <nav class="hidden shrink-0 items-center gap-7 lg:flex" :aria-label="words.mainMenu">
        <NuxtLink v-for="l in links" :key="l.id" class="cap py-3 underline-offset-8 hover:underline" :to="l.url" :target="l.newTab ? '_blank' : undefined">{{ l.label }}</NuxtLink>
        <NuxtLink v-if="cta" class="btn btn-ink !min-h-11 !px-5" :to="cta.url">{{ cta.label }}</NuxtLink>
      </nav>
      <button type="button" class="btn btn-ink !min-h-12 shrink-0 !px-4 lg:hidden" :aria-expanded="menu.open.value" aria-controls="site-menu" @click="menu.show()">
        <UIcon name="i-lucide-menu" class="text-xl" aria-hidden="true" /> {{ words.menu }}
      </button>
    </div>

    <div v-show="menu.open.value" id="site-menu" class="dark fixed inset-0 z-50 overflow-y-auto bg-ink text-paper lg:hidden">
      <div class="wrap flex items-center justify-between py-5">
        <span class="wide min-w-0 text-[17px]" aria-hidden="true">{{ name }}</span>
        <button type="button" class="btn btn-paper !min-h-12 shrink-0 !px-4" @click="menu.hide()"><UIcon name="i-lucide-x" class="text-xl" aria-hidden="true" /> {{ words.close }}</button>
      </div>
      <nav class="wrap wide flex flex-col pb-10 pt-4 text-[30px]" :aria-label="words.mobileMenu">
        <NuxtLink v-for="l in links" :key="l.id" class="flex min-h-16 items-center border-t border-paper/20" :to="l.url" @click="menu.hide()">{{ l.label }}</NuxtLink>
        <NuxtLink v-if="cta" class="flex min-h-16 items-center border-y border-paper/20" :to="cta.url" @click="menu.hide()">{{ cta.label }}</NuxtLink>
      </nav>
    </div>
  </header>
</template>
