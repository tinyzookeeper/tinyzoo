<script setup lang="ts">
// Modrotisk's header: the mark and name, the sections as engraved links, the phone and the
// button. Below a wide desktop the links fold behind a button into a full-screen sheet whose
// links carry the number of their section.
const { nav, settings, name } = await useSite()
const { page } = await useSitePage()
const words = useSiteWords()
const links = computed(() => menuLinks(nav.value?.main))
const cta = computed(() => (settings.value?.ctaLabel && settings.value.ctaUrl ? { label: settings.value.ctaLabel, url: siteHref(settings.value.ctaUrl) } : null))
// "02": the number of the section a link leads to, as the section writes it itself.
const numberOf = (url: string): string => {
  const at = (page.value?.sections ?? []).findIndex((s) => anchorOf(s.type) === url.split('#')[1])
  return at === -1 ? '' : sectionNo(at)
}
const menu = useOverlayMenu()
const long = computed(() => name.value.length > 20)
</script>

<template>
  <header class="wrap">
    <div class="flex items-center justify-between gap-3 sm:gap-6 py-4 lg:py-5 border-b border-line">
      <NuxtLink to="/" class="flex items-center gap-3 min-h-11 min-w-0" :aria-label="words.toTop(name)"><ModrotiskWordmark /></NuxtLink>
      <nav class="hidden xl:flex items-center gap-7" :aria-label="words.mainMenu">
        <NuxtLink v-for="l in links" :key="l.id" class="navlink" :to="l.url" :target="l.newTab ? '_blank' : undefined">{{ l.label }}</NuxtLink>
      </nav>
      <div class="flex items-center gap-3 sm:gap-5 shrink-0">
        <a v-if="settings?.phone" :href="telHref(settings.phone)" class="navlink num hidden xl:inline-flex">{{ settings.phone }}</a>
        <NuxtLink v-if="cta" :to="cta.url" :class="long ? 'hidden lg:inline-flex' : 'hidden sm:inline-flex'" class="btn btn-line min-h-11!">{{ cta.label }}</NuxtLink>
        <button type="button" class="xl:hidden inline-flex items-center justify-center gap-2 min-h-11 min-w-11 px-3 border border-line label text-ink! cursor-pointer" aria-controls="site-menu" :aria-expanded="menu.open.value" @click="menu.show()">
          <UIcon name="i-lucide-menu" class="size-5" aria-hidden="true" /><span>{{ words.menu }}</span>
        </button>
      </div>
    </div>

    <!-- Mobile menu -->
    <div v-show="menu.open.value" id="site-menu" class="fixed inset-0 z-50 bg-paper overflow-y-auto" role="dialog" aria-modal="true" :aria-label="words.menu">
      <div class="wrap py-4">
        <div class="flex items-center justify-between border-b border-line pb-4">
          <span class="font-display text-[1.45rem] leading-none">{{ name }}</span>
          <button type="button" class="inline-flex items-center justify-center gap-2 min-h-11 px-3 border border-line label text-ink! cursor-pointer" @click="menu.hide()"><UIcon name="i-lucide-x" class="size-5" aria-hidden="true" /><span>{{ words.close }}</span></button>
        </div>
        <nav class="mt-4 flex flex-col" :aria-label="words.mobileMenu">
          <NuxtLink v-for="l in links" :key="l.id" class="py-4 border-b border-line font-display text-3xl font-light flex justify-between items-baseline" :to="l.url" @click="menu.hide()">{{ l.label }} <span class="label">{{ numberOf(l.url) }}</span></NuxtLink>
        </nav>
        <div class="mt-8 flex flex-col gap-3">
          <NuxtLink v-if="cta" :to="cta.url" class="btn" @click="menu.hide()">{{ cta.label }}</NuxtLink>
          <a v-if="settings?.phone" :href="telHref(settings.phone)" class="btn btn-line num">{{ settings.phone }}</a>
        </div>
      </div>
    </div>
  </header>
</template>
