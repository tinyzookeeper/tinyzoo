<script setup lang="ts">
// Večer: the monogram on the left, the menu and the button on the right, over whatever opens
// the page (the opening's photograph reaches up behind it). Below a desktop's width the menu
// folds behind a button.
const { nav } = await useSite()
const { settings, names, cta, day, words } = await useWedding()
const links = computed(() => menuLinks(nav.value?.main))
const menu = useOverlayMenu()
</script>

<template>
  <header class="relative z-10">
    <div class="wrap w-full">
      <div class="flex items-center justify-between h-[76px] lg:h-[104px]">
        <NuxtLink to="/" class="rounded-full transition-colors duration-500 hover:bg-brand hover:[&_.monogram]:text-brand-ink" :aria-label="words.toTop(names)"><VecerWordmark /></NuxtLink>
        <nav class="hidden lg:flex items-center gap-9 label" :aria-label="words.mainMenu">
          <NuxtLink v-for="l in links" :key="l.id" class="navlink" :to="l.url" :target="l.newTab ? '_blank' : undefined">{{ l.label }}</NuxtLink>
          <NuxtLink v-if="cta" class="btn btn-line !min-h-[46px] !px-6 ml-2" :to="cta.url">{{ cta.label }}</NuxtLink>
        </nav>
        <button type="button" class="lg:hidden label text-ink inline-flex items-center gap-2 min-h-[44px] pl-4 cursor-pointer" :aria-expanded="menu.open.value" aria-controls="site-menu" @click="menu.show()">
          {{ words.menu }} <UIcon name="i-lucide-menu" class="size-[1.125rem]" aria-hidden="true" />
        </button>
      </div>
    </div>

    <!-- Mobile menu -->
    <div v-show="menu.open.value" id="site-menu" class="fixed inset-0 z-50 bg-night flex flex-col overflow-y-auto lg:hidden">
      <div class="wrap w-full flex items-center justify-between h-[76px] shrink-0">
        <span aria-hidden="true"><VecerWordmark /></span>
        <button type="button" class="label text-ink inline-flex items-center gap-2 min-h-[44px] pl-4 cursor-pointer" @click="menu.hide()">
          {{ words.close }} <UIcon name="i-lucide-x" class="size-[1.125rem]" aria-hidden="true" />
        </button>
      </div>
      <nav class="flex-1 flex flex-col items-center justify-center gap-1 py-6 italic font-light text-ink text-[2.1rem]" :aria-label="words.mobileMenu">
        <NuxtLink v-for="l in links" :key="l.id" class="min-h-[56px] inline-flex items-center text-center" :to="l.url" @click="menu.hide()">{{ l.label }}</NuxtLink>
        <NuxtLink v-if="cta" class="btn label not-italic mt-7" :to="cta.url" @click="menu.hide()">{{ cta.label }}</NuxtLink>
      </nav>
      <p v-if="day || settings?.venueArea" class="label text-quiet text-center pb-8 px-6">{{ [day?.date, beforeComma(settings?.venueArea)].filter(Boolean).join(' · ') }}</p>
    </div>
  </header>
</template>
