<script setup lang="ts">
// Výkres's header: a hairline under a sticky bar, the name, the menu as small capitals, the
// phone and the button. Below a wide desktop the menu folds behind a square button.
const { nav } = await useSite()
const { settings, words, tel, cta, noteOf } = await useFirm()
const links = computed(() => menuLinks(nav.value?.main))
const menu = useOverlayMenu()
</script>

<template>
  <header class="sticky top-0 z-40 border-b border-ink bg-sheet">
    <div class="wrap flex h-[72px] items-center justify-between gap-6">
      <NuxtLink to="/" class="flex min-w-0 items-center gap-3 text-ink"><VykresWordmark /></NuxtLink>
      <nav class="hidden items-center gap-8 xl:flex" :aria-label="words.mainMenu">
        <NuxtLink v-for="l in links" :key="l.id" class="lab !text-ink hover:!text-brand" :to="l.url" :target="l.newTab ? '_blank' : undefined">{{ l.label }}</NuxtLink>
      </nav>
      <div class="flex shrink-0 items-center gap-5">
        <a v-if="tel && settings?.phone" :href="tel" class="hidden whitespace-nowrap font-data text-[17px] font-medium tracking-[.04em] text-ink hover:text-brand sm:block">{{ settings.phone }}</a>
        <NuxtLink v-if="cta" :to="cta.url" class="btn btn-ink hidden !min-h-[44px] whitespace-nowrap sm:inline-flex">{{ cta.label }}</NuxtLink>
        <button type="button" class="flex h-11 w-11 shrink-0 items-center justify-center border border-ink text-ink xl:hidden" :aria-label="words.openMenu" aria-controls="site-menu" :aria-expanded="menu.open.value" @click="menu.show()">
          <UIcon name="i-lucide-menu" class="size-[22px]" aria-hidden="true" />
        </button>
      </div>
    </div>

    <!-- Mobile menu -->
    <div v-show="menu.open.value" id="site-menu" class="fixed inset-0 z-50 overflow-y-auto bg-sheet xl:hidden">
      <div class="wrap flex h-[72px] items-center justify-between border-b border-ink">
        <span class="font-display text-[19px] font-medium text-ink" aria-hidden="true">{{ settings?.siteName }}</span>
        <button type="button" class="flex h-11 w-11 shrink-0 items-center justify-center border border-ink text-ink" :aria-label="words.closeMenu" @click="menu.hide()">
          <UIcon name="i-lucide-x" class="size-[22px]" aria-hidden="true" />
        </button>
      </div>
      <nav class="wrap pt-4" :aria-label="words.mobileMenu">
        <NuxtLink v-for="l in links" :key="l.id" class="flex min-h-[60px] items-center justify-between border-b border-hair font-display text-2xl font-light text-ink" :to="l.url" @click="menu.hide()">
          {{ l.label }} <span v-if="noteOf(l.url)" class="lab">{{ noteOf(l.url) }}</span>
        </NuxtLink>
        <NuxtLink v-if="cta" :to="cta.url" class="btn btn-ink mt-8 w-full" @click="menu.hide()">{{ cta.label }}</NuxtLink>
        <a v-if="tel && settings?.phone" :href="tel" class="btn btn-line mt-3 w-full">{{ settings.phone }}</a>
        <p v-if="settings?.hoursShort" class="mt-6 text-sm text-quiet">{{ tidyText(settings.hoursShort.charAt(0).toUpperCase() + settings.hoursShort.slice(1)) }}.</p>
      </nav>
    </div>
  </header>
</template>
