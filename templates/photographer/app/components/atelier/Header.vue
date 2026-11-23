<script setup lang="ts">
// Ateliér: the menu on the left, the name in the middle, the phone and the button on the right.
// Below a desktop's width (lg) the menu folds behind a button: a tablet has no room for all of it.
const { settings, nav } = await useSite()
const words = useSiteWords()
const links = computed(() => menuLinks(nav.value?.main))
const cta = computed(() => (settings.value?.ctaLabel && settings.value.ctaUrl ? { label: settings.value.ctaLabel, url: siteHref(settings.value.ctaUrl) } : null))
const menu = useOverlayMenu()
</script>

<template>
  <header class="wrap">
    <div class="grid grid-cols-[1fr_auto] lg:grid-cols-[1fr_auto_1fr] items-center h-[76px] md:h-[92px] border-b border-line">
      <nav class="hidden lg:flex gap-8 label" :aria-label="words.mainMenu">
        <NuxtLink v-for="l in links" :key="l.id" class="navlink" :to="l.url" :target="l.newTab ? '_blank' : undefined">{{ l.label }}</NuxtLink>
      </nav>
      <NuxtLink to="/" class="font-display text-ink text-[1.55rem] md:text-[1.8rem] leading-none tracking-[-0.01em] min-h-[44px] inline-flex items-center">
        <AtelierWordmark />
      </NuxtLink>
      <div class="hidden lg:flex justify-end items-center gap-8 label">
        <a v-if="settings?.phone" class="navlink" :href="telHref(settings.phone)">{{ settings.phone }}</a>
        <NuxtLink v-if="cta" class="btn btn-line" :to="cta.url">{{ cta.label }}</NuxtLink>
      </div>
      <button type="button" class="lg:hidden label text-ink inline-flex items-center gap-2 min-h-[44px] pl-4" :aria-expanded="menu.open.value" aria-controls="site-menu" @click="menu.show()">
        {{ words.menu }} <UIcon name="i-lucide-menu" class="size-5" aria-hidden="true" />
      </button>
    </div>

    <!-- Mobile menu -->
    <div v-show="menu.open.value" id="site-menu" class="fixed inset-0 z-50 bg-paper overflow-y-auto lg:hidden">
      <div class="wrap flex flex-col min-h-full pb-8">
        <div class="flex items-center justify-between h-[76px] border-b border-line">
          <span class="font-display text-ink text-[1.55rem] leading-none"><AtelierWordmark /></span>
          <button type="button" class="label text-ink inline-flex items-center gap-2 min-h-[44px] pl-4" @click="menu.hide()">
            {{ words.close }} <UIcon name="i-lucide-x" class="size-5" aria-hidden="true" />
          </button>
        </div>
        <nav class="flex flex-col py-6 font-display text-ink text-[2.1rem] leading-none" :aria-label="words.mobileMenu">
          <NuxtLink v-for="l in links" :key="l.id" class="py-3.5 border-b border-line" :to="l.url" @click="menu.hide()">{{ l.label }}</NuxtLink>
        </nav>
        <div class="mt-auto grid gap-3">
          <NuxtLink v-if="cta" class="btn label" :to="cta.url" @click="menu.hide()">{{ cta.label }}</NuxtLink>
          <a v-if="settings?.phone" class="btn btn-line label" :href="telHref(settings.phone)">{{ settings.phone }}</a>
        </div>
      </div>
    </div>
  </header>
</template>
