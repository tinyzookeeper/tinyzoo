<script setup lang="ts">
// Ciferník's header: one white pill with the mark and name, the menu (folded behind a button
// below a wide desktop) and the phone as a dark pill. The folded menu drops down as a panel.
const { nav } = await useSite()
const { settings, name, words, phoneHref } = await useMedical()
const links = computed(() => menuLinks(nav.value?.main))
// The wide menu has the sections of the page; the notices' link is only in the folded one.
const wide = computed(() => links.value.filter((l) => !l.url.endsWith(`#${anchorOf('notices')}`)))
const menu = useOverlayMenu()
</script>

<template>
  <NuxtLink :to="`/#${anchorOf('hours')}`" class="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-3 focus:rounded-full focus:bg-card focus:px-5 focus:py-3 focus:text-ink">{{ words.skipToHours }}</NuxtLink>
  <header class="wrap pt-4 relative z-30">
    <div class="panel flex items-center justify-between gap-4 pl-4 pr-2.5 py-2.5 rounded-full">
      <NuxtLink to="/" class="flex items-center gap-2.5" :aria-label="words.toTop(name)"><CifernikWordmark /></NuxtLink>
      <nav class="hidden xl:flex items-center gap-0.5" :aria-label="words.mainMenu">
        <NuxtLink v-for="l in wide" :key="l.id" class="navlink" :to="l.url" :target="l.newTab ? '_blank' : undefined">{{ l.label }}</NuxtLink>
      </nav>
      <div class="flex items-center gap-2">
        <a v-if="phoneHref && settings?.phone" :href="phoneHref" class="inline-flex items-center justify-center gap-2 min-h-[2.9rem] min-w-[2.9rem] px-3 sm:px-5 rounded-full bg-ink text-paper font-display font-medium num hover:bg-brand transition-colors" :aria-label="words.callAria(settings.phone)"><UIcon name="i-lucide-phone" class="ic" aria-hidden="true" /><span class="max-sm:hidden">{{ settings.phone }}</span></a>
        <button type="button" class="xl:hidden inline-flex items-center justify-center gap-2 min-h-[2.9rem] px-4 rounded-full bg-soft text-ink font-display font-medium" :aria-expanded="menu.open.value" aria-controls="site-menu" @click="menu.open.value ? menu.hide() : menu.show()"><UIcon name="i-lucide-menu" class="ic size-[22px]" aria-hidden="true" /><span>{{ words.menu }}</span></button>
      </div>
    </div>
    <!-- Mobile menu -->
    <div v-show="menu.open.value" id="site-menu" class="xl:hidden absolute inset-x-[1.15rem] lg:inset-x-10 top-full mt-2 panel p-3 shadow-[0_30px_60px_-20px_rgba(18,48,58,.3)]">
      <nav class="grid" :aria-label="words.mobileMenu">
        <NuxtLink v-for="l in links" :key="l.id" class="disp flex items-center justify-between px-4 py-3.5 rounded-2xl text-[1.3rem] hover:bg-soft" :to="l.url" @click="menu.hide()">{{ l.label }} <UIcon name="i-lucide-arrow-right" class="ic" aria-hidden="true" /></NuxtLink>
      </nav>
    </div>
  </header>
</template>
