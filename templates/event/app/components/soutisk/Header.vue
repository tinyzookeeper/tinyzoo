<script setup lang="ts">
// Soutisk's header: three overprinted dots and the name on the left, the menu and the
// registration button on the right. Below a desktop's width the menu folds behind a button and
// opens as a yellow full-screen list. (The shapes of the hills the sections' edges are cut from
// are drawn once here and used all over the page.)
const { nav } = await useSite()
const { words, cta, day, settings, name } = await useEvent()
const links = computed(() => menuLinks(nav.value?.main))
const menu = useOverlayMenu()
// "Skip to the content": the frame's <main> has no address of its own, so the link moves the focus there.
function skip() {
  const main = document.querySelector<HTMLElement>('main')
  main?.setAttribute('tabindex', '-1')
  main?.focus()
}
</script>

<template>
  <header class="relative z-30">
    <svg width="0" height="0" class="absolute" aria-hidden="true">
      <defs>
        <clipPath id="soutisk-hillclip" clipPathUnits="objectBoundingBox"><path d="M0 .12C.1 .05 .22 0 .36 .025C.5 .05 .6 .115 .72 .1C.84 .085 .92 .03 1 .055V1H0Z" /></clipPath>
        <path id="soutisk-hl1" d="M0 120V70C140 30 260 20 400 46C540 72 620 96 760 80C920 62 1000 8 1160 10C1290 12 1380 50 1440 64V120Z" />
        <path id="soutisk-hl2" d="M0 120V40C110 20 220 30 340 60C470 92 560 88 680 60C820 28 900 20 1040 44C1200 72 1320 84 1440 50V120Z" />
        <path id="soutisk-hl3" d="M0 120V84C90 60 150 22 250 24C360 26 400 80 500 78C590 76 640 12 740 10C850 8 900 76 1000 80C1100 84 1150 34 1250 32C1340 30 1390 60 1440 76V120Z" />
      </defs>
    </svg>
    <a href="#obsah" @click.prevent="skip" class="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:bg-c2 focus:px-4 focus:py-3 focus:rounded-full">{{ words.skip }}</a>
    <div class="wrap flex items-center justify-between gap-6 h-[5rem]">
      <NuxtLink to="/" class="flex items-center gap-2.5 min-h-11 min-w-0" :aria-label="words.toTop(name)"><SoutiskWordmark /></NuxtLink>
      <nav class="hidden lg:flex items-center gap-1 text-[1rem]" :aria-label="words.mainMenu">
        <NuxtLink v-for="l in links" :key="l.id" class="navlink" :to="l.url" :target="l.newTab ? '_blank' : undefined">{{ l.label }}</NuxtLink>
      </nav>
      <div class="flex items-center gap-2 shrink-0">
        <a v-if="cta" :href="cta.url" class="btn !min-h-11 !px-5 !text-base hidden sm:inline-flex">{{ cta.label }} <UIcon name="i-lucide-arrow-up-right" aria-hidden="true" /></a>
        <button type="button" class="lg:hidden inline-flex items-center justify-center gap-2 h-11 px-4 rounded-full bg-ink text-paper font-bold cursor-pointer" :aria-expanded="menu.open.value" aria-controls="site-menu" @click="menu.show()">
          <UIcon name="i-lucide-menu" class="text-xl" aria-hidden="true" />{{ words.menu }}
        </button>
      </div>
    </div>

    <!-- Mobile menu -->
    <div v-show="menu.open.value" id="site-menu" class="lg:hidden fixed inset-0 z-40 bg-c2 overflow-y-auto">
      <div class="wrap flex items-center justify-between h-[5rem]">
        <span aria-hidden="true"><SoutiskWordmark plain /></span>
        <button type="button" class="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-full bg-ink text-paper font-bold cursor-pointer" @click="menu.hide()"><UIcon name="i-lucide-x" class="text-xl" aria-hidden="true" />{{ words.close }}</button>
      </div>
      <nav class="wrap pt-4 pb-10 flex flex-col" :aria-label="words.mobileMenu">
        <NuxtLink v-for="l in links" :key="l.id" class="disp text-[2.1rem] min-h-[60px] flex items-center" :to="l.url" @click="menu.hide()">{{ l.label }}</NuxtLink>
        <a v-if="cta" :href="cta.url" class="btn w-full mt-6">{{ cta.label }} <UIcon name="i-lucide-arrow-up-right" aria-hidden="true" /></a>
        <p v-if="day || settings?.venueName" class="mt-5 font-medium">{{ [day ? `${day.weekday} ${day.date}` : '', settings?.venueName].filter(Boolean).join(' · ') }}</p>
      </nav>
    </div>
  </header>
</template>
