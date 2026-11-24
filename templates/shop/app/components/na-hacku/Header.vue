<script setup lang="ts">
// Na háčku: a white pill hanging on the pegboard (the name beside its two keys, the menu, the
// phone and a button). The board is as tall as three rows of holes and goes on under the opening,
// so the pattern runs unbroken. Below 1280 px the menu folds behind a button.
const { nav } = await useSite()
const { settings, name, words, week, place, cta } = await useShop()
const links = computed(() => menuLinks(nav.value?.main))
const menu = useOverlayMenu()
const opening = useOpening(week)
</script>

<template>
  <header class="board h-[108px]">
    <div class="wrap pt-4 md:pt-6">
      <div class="plate flex items-center justify-between gap-4 !rounded-full py-2 pl-5 pr-2 md:pl-7">
        <NuxtLink to="/" class="flex min-h-11 items-center gap-2.5" :aria-label="words.toTop(name)"><NaHackuWordmark /></NuxtLink>
        <nav class="hidden items-center xl:flex" :aria-label="words.mainMenu">
          <NuxtLink v-for="l in links" :key="l.id" class="navlink" :to="l.url" :target="l.newTab ? '_blank' : undefined">{{ l.label }}</NuxtLink>
        </nav>
        <div class="flex items-center gap-2">
          <a v-if="settings?.phone" :href="phoneHref(settings.phone)" class="navlink hidden sm:inline-flex"><UIcon name="i-lucide-phone" class="mr-2" aria-hidden="true" />{{ settings.phone }}</a>
          <NuxtLink v-if="cta" :to="cta.url" class="btn btn-sm hidden xl:inline-flex">{{ cta.label }}</NuxtLink>
          <button type="button" class="btn btn-sm xl:hidden" :aria-expanded="menu.open.value" aria-controls="site-menu" @click="menu.show()"><UIcon name="i-lucide-menu" aria-hidden="true" /> {{ words.menu }}</button>
        </div>
      </div>
    </div>

    <!-- Mobile menu -->
    <div v-show="menu.open.value" id="site-menu" class="fixed inset-0 z-50 flex-col overflow-y-auto bg-card px-5 pb-8 pt-4 text-ink xl:hidden" :class="menu.open.value ? 'flex' : ''" role="dialog" aria-modal="true" :aria-label="words.menu">
      <div class="flex items-center justify-between">
        <span class="flex items-center gap-2.5" aria-hidden="true"><NaHackuKeys class="size-8 text-brand" /><span class="disp text-[1.4rem] font-extrabold leading-none">{{ name }}</span></span>
        <button type="button" class="btn btn-sm" @click="menu.hide()"><UIcon name="i-lucide-x" aria-hidden="true" /> {{ words.close }}</button>
      </div>
      <nav class="mt-8 grid gap-2" :aria-label="words.mobileMenu">
        <NuxtLink v-for="l in links" :key="l.id" class="disp rounded-2xl bg-tint px-5 py-3.5 text-[1.5rem] font-bold" :to="l.url" @click="menu.hide()">{{ l.label }}</NuxtLink>
      </nav>
      <p class="mt-7 font-bold" :data-state="opening ? 'known' : 'unknown'">{{ opening?.open === false ? words.closed : words.open }}, {{ opening ? words.openDetail(opening.detail) : '' }} · {{ place }}</p>
      <div class="mt-4 grid gap-3">
        <NuxtLink v-if="cta" :to="cta.url" class="btn" @click="menu.hide()">{{ words.askLong }}</NuxtLink>
        <a v-if="settings?.phone" :href="phoneHref(settings.phone)" class="btn btn-line"><UIcon name="i-lucide-phone" aria-hidden="true" /> {{ settings.phone }}</a>
      </div>
    </div>
  </header>
</template>
