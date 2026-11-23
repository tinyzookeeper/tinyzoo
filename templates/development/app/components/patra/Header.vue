<script setup lang="ts">
// Patra's header: the mark and name, the sections as plain links, the phone and the button.
// Below a desktop's width the links fold behind a button into a full-screen sheet of large serif
// links.
const { nav, settings, name } = await useSite()
const words = useSiteWords()
const links = computed(() => menuLinks(nav.value?.main))
const cta = computed(() => (settings.value?.ctaLabel && settings.value.ctaUrl ? { label: settings.value.ctaLabel, url: siteHref(settings.value.ctaUrl) } : null))
const menu = useOverlayMenu()
// a long name takes the room of the links: they fold behind the button up to a wide desktop
const long = computed(() => name.value.length > 20)
</script>

<template>
  <header class="border-b border-line">
    <div class="wrap flex items-center justify-between gap-3 sm:gap-6 min-h-[4.75rem]">
      <NuxtLink to="/" class="flex items-center gap-3 min-h-11 min-w-0" :aria-label="words.toTop(name)"><PatraWordmark /></NuxtLink>
      <nav :class="long ? 'hidden xl:flex gap-6' : 'hidden lg:flex gap-8'" class="items-center" :aria-label="words.mainMenu">
        <NuxtLink v-for="l in links" :key="l.id" class="navlink" :to="l.url" :target="l.newTab ? '_blank' : undefined">{{ l.label }}</NuxtLink>
      </nav>
      <div class="flex items-center gap-3 sm:gap-6 shrink-0">
        <a v-if="settings?.phone" :href="telHref(settings.phone)" class="hidden xl:inline-flex navlink font-medium! num">{{ settings.phone }}</a>
        <NuxtLink v-if="cta" :to="cta.url" class="btn min-h-11! hidden sm:inline-flex">{{ cta.label }}</NuxtLink>
        <button type="button" :class="long ? 'xl:hidden' : 'lg:hidden'" class="btn btn-line min-h-11! px-4!" aria-controls="site-menu" :aria-expanded="menu.open.value" @click="menu.show()">
          <UIcon name="i-lucide-menu" class="size-5" aria-hidden="true" /><span>{{ words.menu }}</span>
        </button>
      </div>
    </div>

    <!-- Mobile menu -->
    <div v-show="menu.open.value" id="site-menu" class="fixed inset-0 z-50 bg-paper overflow-y-auto" role="dialog" aria-modal="true" :aria-label="words.menu">
      <div class="wrap">
        <div class="flex items-center justify-between h-[4.75rem] border-b border-line">
          <span class="serif text-[1.75rem] leading-none">{{ name }}</span>
          <button type="button" class="btn btn-line min-h-11! px-4!" @click="menu.hide()"><UIcon name="i-lucide-x" class="size-5" aria-hidden="true" /><span>{{ words.close }}</span></button>
        </div>
        <nav class="py-3 flex flex-col" :aria-label="words.mobileMenu">
          <NuxtLink v-for="l in links" :key="l.id" class="serif text-[2rem] py-3.5 border-b border-line" :to="l.url" @click="menu.hide()">{{ l.label }}</NuxtLink>
        </nav>
        <div class="py-6 flex flex-col gap-3">
          <NuxtLink v-if="cta" :to="cta.url" class="btn" @click="menu.hide()">{{ cta.label }}</NuxtLink>
          <a v-if="settings?.phone" :href="telHref(settings.phone)" class="btn btn-line num">{{ settings.phone }}</a>
        </div>
      </div>
    </div>
  </header>
</template>
