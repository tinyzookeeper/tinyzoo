<script setup lang="ts">
// Návod's header: the mark and name on the left, the menu in the middle, sign-in and the main
// button on the right, a ruled line under it. Below a desktop's width the menu folds behind a
// button and opens as a sheet under the header.
const { nav } = await useSite()
const { name, words, cta, login } = await useSoftware()
const links = computed(() => menuLinks(nav.value?.main))
const menu = useOverlayMenu()
</script>

<template>
  <header class="border-b border-ink/15">
    <div class="wrap flex h-[72px] items-center justify-between gap-6">
      <NuxtLink to="/" class="flex items-center gap-2.5 text-ink" :aria-label="words.toTop(name)"><NavodWordmark /></NuxtLink>
      <nav class="hidden items-center gap-8 text-[15px] font-medium text-ink lg:flex" :aria-label="words.mainMenu">
        <SiteLink v-for="l in links" :key="l.id" class="hover:text-brand" :to="l.url">{{ l.label }}</SiteLink>
      </nav>
      <div class="hidden items-center gap-6 lg:flex">
        <SiteLink v-if="login" class="text-[15px] font-medium text-ink hover:text-brand" :to="login.url">{{ login.label }}</SiteLink>
        <SiteLink v-if="cta" class="btn btn-main !min-h-[44px] !px-[18px] !text-[15px]" :to="cta.url">{{ cta.label }}</SiteLink>
      </div>
      <button type="button" class="-mr-2 inline-flex h-11 w-11 cursor-pointer items-center justify-center text-ink lg:hidden" :aria-expanded="menu.open.value" aria-controls="site-menu" :aria-label="menu.open.value ? words.closeMenu : words.openMenu" @click="menu.open.value ? menu.hide() : menu.show()">
        <UIcon :name="menu.open.value ? 'i-lucide-x' : 'i-lucide-menu'" class="size-[26px]" aria-hidden="true" />
      </button>
    </div>
    <div v-show="menu.open.value" id="site-menu" class="border-t border-ink/15 bg-sheet lg:hidden">
      <nav class="wrap flex flex-col py-3 text-[18px] font-medium text-ink" :aria-label="words.mobileMenu">
        <SiteLink v-for="l in links" :key="l.id" class="flex min-h-[48px] items-center border-b border-line" :to="l.url" @click="menu.hide()">{{ l.label }}</SiteLink>
        <SiteLink v-if="login" class="flex min-h-[48px] items-center" :to="login.url">{{ login.label }}</SiteLink>
        <SiteLink v-if="cta" class="btn btn-main my-3" :to="cta.url" @click="menu.hide()">{{ tidyText(cta.longLabel) }}</SiteLink>
      </nav>
    </div>
  </header>
</template>
