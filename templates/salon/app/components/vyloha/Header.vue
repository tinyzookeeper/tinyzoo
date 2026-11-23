<script setup lang="ts">
// Výloha: the shop sign. The menu on the left, the name on a panel with scooped corners in the
// middle, the phone and an enamel booking plate on the right. Below a desktop's width (here the
// width where the three columns stop fitting) the menu folds behind a button.
const { nav } = await useSite()
const { settings, name, words, phone } = await useSalon()
const links = computed(() => menuLinks(nav.value?.main))
const menu = useOverlayMenu()
</script>

<template>
  <header class="wrap pt-5 md:pt-7">
    <div class="grid grid-cols-[1fr_auto] xl:grid-cols-[1fr_auto_1fr] items-center gap-6">
      <nav class="hidden xl:flex items-center gap-8 caps whitespace-nowrap" :aria-label="words.mainMenu">
        <NuxtLink v-for="l in links" :key="l.id" :to="l.url" :target="l.newTab ? '_blank' : undefined" class="py-3 hover:text-brass">{{ l.label }}</NuxtLink>
      </nav>
      <NuxtLink to="/" class="panel justify-self-start xl:justify-self-center px-6 md:px-10 py-3 md:py-4 text-center" style="--r:12px" :aria-label="words.toTop(name)">
        <VylohaWordmark />
        <span v-if="settings?.tagline" class="hidden md:block mt-2 caps !text-[10px] text-brass">{{ settings.tagline }}</span>
      </NuxtLink>
      <div class="flex items-center justify-end gap-3">
        <a v-if="phone" :href="phone.href" class="hidden md:inline-flex items-center gap-2 min-h-11 font-display text-[19px] tracking-[.06em] text-cream hover:text-brass whitespace-nowrap"><UIcon name="i-lucide-phone" class="text-brass text-base" aria-hidden="true" />{{ phone.text }}</a>
        <NuxtLink :to="`/#${anchorOf('booking')}`" class="plate btn btn-cream hidden sm:inline-flex !min-h-11 !px-6 !text-[13px] md:ml-4 whitespace-nowrap">{{ words.book }}</NuxtLink>
        <button type="button" class="xl:hidden inline-flex items-center justify-center w-11 h-11 border border-brass text-cream text-xl cursor-pointer" :aria-label="words.openMenu" aria-controls="site-menu" :aria-expanded="menu.open.value" @click="menu.show()"><UIcon name="i-lucide-menu" aria-hidden="true" /></button>
      </div>
    </div>
  </header>

  <!-- Mobile menu -->
  <div v-show="menu.open.value" id="site-menu" class="fixed inset-0 z-50 bg-glass overflow-y-auto xl:hidden" role="dialog" aria-modal="true" :aria-label="words.menu">
    <div class="wrap flex items-center justify-between pt-5">
      <span aria-hidden="true"><VylohaWordmark /></span>
      <button type="button" class="inline-flex items-center justify-center w-11 h-11 border border-brass text-cream text-xl cursor-pointer" :aria-label="words.closeMenu" @click="menu.hide()"><UIcon name="i-lucide-x" aria-hidden="true" /></button>
    </div>
    <nav class="wrap pt-10 pb-10 text-center" :aria-label="words.mobileMenu">
      <div class="panel px-6 py-8">
        <ul class="font-display text-cream text-[32px] leading-none">
          <li v-for="l in links" :key="l.id"><NuxtLink class="block py-4" :to="l.url" @click="menu.hide()">{{ l.label }}</NuxtLink></li>
        </ul>
      </div>
      <div class="mt-8 grid gap-4">
        <NuxtLink :to="`/#${anchorOf('booking')}`" class="plate btn btn-cream" @click="menu.hide()">{{ words.book }}</NuxtLink>
        <a v-if="phone" :href="phone.href" class="panel btn btn-line"><UIcon name="i-lucide-phone" aria-hidden="true" />{{ phone.text }}</a>
      </div>
    </nav>
  </div>
</template>
