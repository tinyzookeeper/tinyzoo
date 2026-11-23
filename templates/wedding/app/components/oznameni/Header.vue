<script setup lang="ts">
// Oznámení: the first half of the menu on the left, the monogram in the middle, the rest and
// the button on the right. Below a desktop's width the menu folds behind a button.
const { nav } = await useSite()
const { settings, names, cta, day, words } = await useWedding()
const links = computed(() => menuLinks(nav.value?.main))
const half = computed(() => Math.ceil(links.value.length / 2))
const menu = useOverlayMenu()
</script>

<template>
  <header class="wrap">
    <div class="grid grid-cols-[1fr_auto] lg:grid-cols-[1fr_auto_1fr] items-center h-[72px] lg:h-[100px]">
      <nav class="hidden lg:flex gap-10 label" :aria-label="words.mainMenu">
        <NuxtLink v-for="l in links.slice(0, half)" :key="l.id" class="navlink" :to="l.url" :target="l.newTab ? '_blank' : undefined">{{ l.label }}</NuxtLink>
      </nav>
      <NuxtLink to="/" class="font-display text-ink text-[1.7rem] leading-none min-h-[44px] inline-flex items-center" :aria-label="words.toTop(names)"><OznameniWordmark /></NuxtLink>
      <div class="hidden lg:flex justify-end items-center gap-10 label">
        <NuxtLink v-for="l in links.slice(half)" :key="l.id" class="navlink" :to="l.url" :target="l.newTab ? '_blank' : undefined">{{ l.label }}</NuxtLink>
        <NuxtLink v-if="cta" class="btn btn-line !min-h-[44px] !px-6" :to="cta.url">{{ cta.label }}</NuxtLink>
      </div>
      <button type="button" class="lg:hidden label text-ink inline-flex items-center gap-2 min-h-[44px] pl-4 cursor-pointer" :aria-expanded="menu.open.value" aria-controls="site-menu" @click="menu.show()">
        {{ words.menu }} <UIcon name="i-lucide-menu" class="size-[1.125rem]" aria-hidden="true" />
      </button>
    </div>

    <!-- Mobile menu -->
    <div v-show="menu.open.value" id="site-menu" class="fixed inset-0 z-50 bg-paper flex flex-col overflow-y-auto lg:hidden">
      <div class="wrap w-full flex items-center justify-between h-[72px] shrink-0">
        <span class="font-display text-ink text-[1.7rem] leading-none"><OznameniWordmark /></span>
        <button type="button" class="label text-ink inline-flex items-center gap-2 min-h-[44px] pl-4 cursor-pointer" @click="menu.hide()">
          {{ words.close }} <UIcon name="i-lucide-x" class="size-[1.125rem]" aria-hidden="true" />
        </button>
      </div>
      <nav class="flex-1 flex flex-col items-center justify-center gap-1 py-6 font-display text-ink text-[2rem]" :aria-label="words.mobileMenu">
        <NuxtLink v-for="l in links" :key="l.id" class="min-h-[52px] inline-flex items-center text-center" :to="l.url" @click="menu.hide()">{{ l.label }}</NuxtLink>
        <NuxtLink v-if="cta" class="btn mt-6 font-serif !text-base label" :to="cta.url" @click="menu.hide()">{{ cta.label }}</NuxtLink>
      </nav>
      <p v-if="day || settings?.venueArea" class="label text-quiet text-center pb-8 px-5">{{ [day?.date, beforeComma(settings?.venueArea)].filter(Boolean).join(' · ') }}</p>
    </div>
  </header>
</template>
