<script setup lang="ts">
// Magnets' header: the name on the product's orange, the menu as pills that turn dark under the
// pointer, the sign-in link and the main button. Below a desktop's width the menu folds behind a
// round button and opens as a dark tile under the header.
const { nav } = await useSite()
const { name, words, cta, login } = await useSoftware()
const links = computed(() => menuLinks(nav.value?.main))
const menu = useOverlayMenu()
</script>

<template>
  <header class="bg-brand">
    <div class="wrap">
      <div class="flex h-[76px] items-center justify-between gap-6">
        <NuxtLink to="/" class="flex items-center gap-2" :aria-label="words.toTop(name)"><MagnetyWordmark /></NuxtLink>
        <nav class="hidden items-center gap-1 text-[16px] font-medium lg:flex" :aria-label="words.mainMenu">
          <SiteLink v-for="l in links" :key="l.id" class="rounded-full px-4 py-2.5 transition-colors hover:bg-ink hover:text-cream" :to="l.url">{{ l.label }}</SiteLink>
        </nav>
        <div class="hidden items-center gap-2 lg:flex">
          <SiteLink v-if="login" class="rounded-full px-4 py-2.5 text-[16px] font-medium transition-colors hover:bg-ink hover:text-cream" :to="login.url">{{ login.label }}</SiteLink>
          <SiteLink v-if="cta" class="btn btn-ink !min-h-[46px] !px-5 !text-[16px]" :to="cta.url">{{ cta.label }}</SiteLink>
        </div>
        <button type="button" class="inline-flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-ink text-cream lg:hidden" :aria-expanded="menu.open.value" aria-controls="site-menu" :aria-label="menu.open.value ? words.closeMenu : words.openMenu" @click="menu.open.value ? menu.hide() : menu.show()">
          <UIcon :name="menu.open.value ? 'i-lucide-x' : 'i-lucide-menu'" class="size-6" aria-hidden="true" />
        </button>
      </div>
      <div v-show="menu.open.value" id="site-menu" class="on-dark tile mb-4 bg-ink p-3 text-cream lg:hidden">
        <nav class="flex flex-col font-display text-[26px] font-bold" :aria-label="words.mobileMenu">
          <SiteLink v-for="l in links" :key="l.id" class="flex min-h-[52px] items-center rounded-2xl px-4 hover:bg-cream/10" :to="l.url" @click="menu.hide()">{{ l.label }}</SiteLink>
          <SiteLink v-if="login" class="flex min-h-[52px] items-center rounded-2xl px-4 hover:bg-cream/10" :to="login.url">{{ login.label }}</SiteLink>
          <SiteLink v-if="cta" class="btn btn-brand mt-2" :to="cta.url" @click="menu.hide()">{{ tidyText(cta.longLabel) }}</SiteLink>
        </nav>
      </div>
    </div>
  </header>
</template>
