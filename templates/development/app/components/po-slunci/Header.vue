<script setup lang="ts">
// Po slunci's header: the mark and name, the sections as round-cornered links, the phone and the
// button, on the soft ground the opening continues. Below a desktop's width the links fold behind
// a button into a full-screen sheet of rounded rows.
const { nav, settings, name } = await useSite()
const words = useSiteWords()
const links = computed(() => menuLinks(nav.value?.main))
const cta = computed(() => (settings.value?.ctaLabel && settings.value.ctaUrl ? { label: settings.value.ctaLabel, url: siteHref(settings.value.ctaUrl) } : null))
const menu = useOverlayMenu()
</script>

<template>
  <header class="bg-soft">
    <div class="wrap flex items-center justify-between gap-3 sm:gap-6 py-4">
      <!-- (a long name wraps on a phone instead of pushing the menu's button off the screen) -->
      <NuxtLink to="/" class="flex items-center gap-2.5 min-h-11 min-w-0" :aria-label="words.toTop(name)"><PoSlunciWordmark /></NuxtLink>
      <nav class="hidden lg:flex items-center gap-1" :aria-label="words.mainMenu">
        <NuxtLink v-for="l in links" :key="l.id" class="navlink" :to="l.url" :target="l.newTab ? '_blank' : undefined">{{ l.label }}</NuxtLink>
      </nav>
      <div class="flex items-center gap-3 shrink-0">
        <a v-if="settings?.phone" :href="telHref(settings.phone)" class="navlink num hidden xl:inline-flex gap-2"><UIcon name="i-lucide-phone" class="size-[1.0625rem]" aria-hidden="true" />{{ settings.phone }}</a>
        <NuxtLink v-if="cta" :to="cta.url" class="btn min-h-12! hidden sm:inline-flex">{{ cta.label }}</NuxtLink>
        <button type="button" class="lg:hidden btn btn-ghost min-h-12! px-4!" aria-controls="site-menu" :aria-expanded="menu.open.value" @click="menu.show()">
          <UIcon name="i-lucide-menu" class="size-5" aria-hidden="true" /><span>{{ words.menu }}</span>
        </button>
      </div>
    </div>

    <!-- Mobile menu -->
    <div v-show="menu.open.value" id="site-menu" class="fixed inset-0 z-50 bg-paper text-ink overflow-y-auto" role="dialog" aria-modal="true" :aria-label="words.menu">
      <div class="wrap py-4">
        <div class="flex items-center justify-between">
          <span class="serif text-[1.7rem] leading-none">{{ name }}</span>
          <button type="button" class="btn btn-ghost min-h-12! px-4!" @click="menu.hide()"><UIcon name="i-lucide-x" class="size-5" aria-hidden="true" /><span>{{ words.close }}</span></button>
        </div>
        <nav class="mt-6 flex flex-col gap-2" :aria-label="words.mobileMenu">
          <NuxtLink v-for="l in links" :key="l.id" class="serif text-[1.8rem] px-6 py-3 rounded-full bg-soft" :to="l.url" @click="menu.hide()">{{ l.label }}</NuxtLink>
        </nav>
        <div class="mt-6 flex flex-col gap-3">
          <NuxtLink v-if="cta" :to="cta.url" class="btn" @click="menu.hide()">{{ cta.label }}</NuxtLink>
          <a v-if="settings?.phone" :href="telHref(settings.phone)" class="btn btn-ghost num">{{ settings.phone }}</a>
        </div>
      </div>
    </div>
  </header>
</template>
