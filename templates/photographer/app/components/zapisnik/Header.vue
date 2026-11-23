<script setup lang="ts">
const { settings, nav } = await useSite()
const words = useSiteWords()
const links = computed(() => menuLinks(nav.value?.main))
const cta = computed(() => (settings.value?.ctaLabel && settings.value.ctaUrl ? { label: settings.value.ctaLabel, url: siteHref(settings.value.ctaUrl) } : null))
const menu = useOverlayMenu()
</script>

<template>
  <header class="wrap flex items-center justify-between h-[76px] md:h-[96px]">
    <NuxtLink to="/" class="inline-flex items-center min-h-[44px] font-display text-ink text-[1.45rem] md:text-[1.6rem] leading-none"><ZapisnikWordmark /></NuxtLink>
    <nav class="hidden lg:flex items-center gap-8" :aria-label="words.mainMenu">
      <NuxtLink v-for="l in links" :key="l.id" class="navlink" :to="l.url" :target="l.newTab ? '_blank' : undefined">{{ l.label }}</NuxtLink>
      <NuxtLink v-if="cta" class="btn btn-line !min-h-[46px]" :to="cta.url">{{ cta.label }}</NuxtLink>
    </nav>
    <button type="button" class="lg:hidden inline-flex items-center gap-2 min-h-[44px] px-4 -mr-1 rounded-full font-bold text-ink shadow-[inset_0_0_0_1.5px_var(--ink)]" :aria-expanded="menu.open.value" aria-controls="site-menu" @click="menu.show()">
      <UIcon name="i-lucide-menu" class="size-[18px]" aria-hidden="true" /> {{ words.menu }}
    </button>

    <!-- Mobile menu -->
    <div v-show="menu.open.value" id="site-menu" class="fixed inset-0 z-50 bg-paper overflow-y-auto lg:hidden">
      <div class="wrap flex flex-col min-h-full pb-8">
        <div class="flex items-center justify-between h-[76px]">
          <span class="font-display text-ink text-[1.45rem] leading-none"><ZapisnikWordmark /></span>
          <button type="button" class="inline-flex items-center gap-2 min-h-[44px] px-4 -mr-1 rounded-full font-bold text-ink shadow-[inset_0_0_0_1.5px_var(--ink)]" @click="menu.hide()">
            <UIcon name="i-lucide-x" class="size-[18px]" aria-hidden="true" /> {{ words.close }}
          </button>
        </div>
        <nav class="flex flex-col pt-6 font-display text-ink text-[2.5rem] leading-none" :aria-label="words.mobileMenu">
          <NuxtLink v-for="l in links" :key="l.id" class="py-3" :to="l.url" @click="menu.hide()">{{ l.label }}</NuxtLink>
          <NuxtLink v-if="cta" class="py-3 text-brand" :to="cta.url" @click="menu.hide()">{{ cta.label }}</NuxtLink>
        </nav>
        <p v-if="settings?.availability" class="hand text-brand text-[1.9rem] mt-8 -rotate-2 origin-left">{{ tidyText(settings.availability) }}</p>
        <div class="mt-auto pt-8 grid gap-1 font-bold text-ink">
          <a v-if="settings?.phone" class="navlink !font-bold" :href="telHref(settings.phone)">{{ settings.phone }}</a>
          <a v-if="settings?.email" class="navlink !font-bold" :href="`mailto:${settings.email}`">{{ settings.email }}</a>
        </div>
      </div>
    </div>
  </header>
</template>
