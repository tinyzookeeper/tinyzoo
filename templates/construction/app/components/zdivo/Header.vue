<script setup lang="ts">
// Zdivo's header: plaster, the bricks and the name, the menu underlined in the colour of the
// site, the phone and the button. Below a wide desktop the menu folds behind a button and opens
// as a wall of clay blocks, every other one pushed in like a bond.
const { nav } = await useSite()
const { settings, words, tel, cta } = await useFirm()
const links = computed(() => menuLinks(nav.value?.main))
const menu = useOverlayMenu()
</script>

<template>
  <header class="sticky top-0 z-40 bg-plaster">
    <div class="wrap flex h-[76px] items-center justify-between gap-6">
      <NuxtLink to="/" class="flex min-w-0 items-center gap-3 text-ink"><ZdivoWordmark /></NuxtLink>
      <nav class="hidden items-center gap-8 xl:flex" :aria-label="words.mainMenu">
        <NuxtLink v-for="l in links" :key="l.id" class="font-semibold text-ink underline-offset-[6px] hover:underline hover:decoration-brand hover:decoration-2" :to="l.url" :target="l.newTab ? '_blank' : undefined">{{ l.label }}</NuxtLink>
      </nav>
      <div class="flex shrink-0 items-center gap-3">
        <a v-if="tel && settings?.phone" :href="tel" class="hidden min-h-[44px] items-center gap-2 whitespace-nowrap px-2 font-bold text-ink hover:text-brand sm:inline-flex"><UIcon name="i-lucide-phone" class="size-[17px]" aria-hidden="true" />{{ settings.phone }}</a>
        <NuxtLink v-if="cta" :to="cta.url" class="btn btn-brand hidden !min-h-[46px] whitespace-nowrap !px-5 sm:inline-flex">{{ cta.label }}</NuxtLink>
        <button type="button" class="flex h-11 w-11 shrink-0 items-center justify-center rounded-[4px] bg-ink text-plaster xl:hidden" :aria-label="words.openMenu" aria-controls="site-menu" :aria-expanded="menu.open.value" @click="menu.show()">
          <UIcon name="i-lucide-menu" class="size-[22px]" aria-hidden="true" />
        </button>
      </div>
    </div>

    <!-- Mobile menu -->
    <div v-show="menu.open.value" id="site-menu" class="fixed inset-0 z-50 overflow-y-auto bg-brand text-brand-ink xl:hidden">
      <div class="wrap flex h-[76px] items-center justify-between">
        <span class="font-display text-[27px] font-extrabold leading-none" aria-hidden="true">{{ settings?.siteName }}</span>
        <button type="button" class="flex h-11 w-11 shrink-0 items-center justify-center rounded-[4px] bg-brand-ink text-brand" :aria-label="words.closeMenu" @click="menu.hide()">
          <UIcon name="i-lucide-x" class="size-[22px]" aria-hidden="true" />
        </button>
      </div>
      <nav class="wrap flex flex-col gap-2 pt-4" :aria-label="words.mobileMenu">
        <NuxtLink v-for="(l, i) in links" :key="l.id" class="flex min-h-[64px] items-center rounded-[4px] bg-brand-d px-5 font-display text-[30px] font-bold" :class="i % 2 ? 'ml-8' : ''" :to="l.url" @click="menu.hide()">{{ l.label }}</NuxtLink>
        <NuxtLink v-if="cta" :to="cta.url" class="btn btn-ink mt-6 w-full" @click="menu.hide()">{{ cta.label }}</NuxtLink>
        <a v-if="tel && settings?.phone" :href="tel" class="btn mt-1 w-full bg-brand-ink text-brand"><UIcon name="i-lucide-phone" class="size-[17px]" aria-hidden="true" />{{ settings.phone }}</a>
      </nav>
    </div>
  </header>
</template>
