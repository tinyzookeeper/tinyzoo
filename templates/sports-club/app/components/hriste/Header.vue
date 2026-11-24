<script setup lang="ts">
// Hřiště's masthead: the round badge and the club's name, the menu as soft pills and the
// membership button. Below a desktop's width the menu is a rounded sheet that drops down.
const { nav, name } = await useSite()
const { cta, words } = await useClub()
const links = computed(() => menuLinks(nav.value?.main))
const menu = useOverlayMenu()
</script>

<template>
  <header class="wrap">
    <div class="flex items-center justify-between gap-6 py-3.5 lg:py-5">
      <NuxtLink to="/" class="min-w-0" :aria-label="words.homeOf(name)"><HristeWordmark /></NuxtLink>
      <nav class="hidden shrink-0 items-center gap-1 font-display text-[16px] font-bold lg:flex" :aria-label="words.mainMenu">
        <NuxtLink v-for="l in links" :key="l.id" class="rounded-full px-4 py-2.5 transition-colors hover:bg-tint" :to="l.url" :target="l.newTab ? '_blank' : undefined">{{ l.label }}</NuxtLink>
        <NuxtLink v-if="cta" class="btn ml-3" :to="cta.url">{{ cta.label }}</NuxtLink>
      </nav>
      <button type="button" class="btn btn-soft shrink-0 !px-5 lg:hidden" :aria-expanded="menu.open.value" aria-controls="site-menu" @click="menu.open.value ? menu.hide() : menu.show()">
        <UIcon :name="menu.open.value ? 'i-lucide-x' : 'i-lucide-menu'" class="text-xl" aria-hidden="true" /><span>{{ menu.open.value ? words.close : words.menu }}</span>
      </button>
    </div>
    <nav v-show="menu.open.value" id="site-menu" class="pb-4 lg:hidden" :aria-label="words.mobileMenu">
      <div class="rounded-3xl bg-tint p-3 font-display text-[20px] font-extrabold">
        <NuxtLink v-for="l in links" :key="l.id" class="flex min-h-13 items-center justify-between rounded-2xl px-4 hover:bg-white" :to="l.url" @click="menu.hide()">{{ l.label }} <UIcon name="i-lucide-chevron-right" class="text-quiet" aria-hidden="true" /></NuxtLink>
        <NuxtLink v-if="cta" class="btn mt-2 w-full" :to="cta.url" @click="menu.hide()">{{ cta.label }}</NuxtLink>
      </div>
    </nav>
  </header>
</template>
