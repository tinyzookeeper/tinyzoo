<script setup lang="ts">
// Čtvero dob's header: the mark on the left, the menu in the middle and the button on the right,
// laid over the top of the opening's quiet ground. Below a desktop's width the menu folds behind
// a button into a card, each link with the small mark of a season.
const { nav } = await useSite()
const { name, cta, words } = await useAssociation()
const links = computed(() => menuLinks(nav.value?.main))
const menu = useOverlayMenu()
// (the small marks beside the links of the folded menu, in turn: decoration only)
const DOTS = ['bg-podzim-m', 'bg-zima-m', 'bg-leto-m', 'bg-ink', 'bg-jaro-m', 'bg-brand']
</script>

<template>
  <header class="absolute inset-x-0 top-0 z-30">
    <div class="wrap flex h-[80px] items-center justify-between gap-6">
      <NuxtLink to="/" class="flex min-h-[44px] items-center gap-2.5 text-ink" :aria-label="words.toTop(name)"><CtveroDobWordmark /></NuxtLink>
      <nav class="hidden items-center gap-1 lg:flex" :aria-label="words.mainMenu">
        <NuxtLink v-for="l in links" :key="l.id" class="nav-a" :to="l.url" :target="l.newTab ? '_blank' : undefined">{{ l.label }}</NuxtLink>
      </nav>
      <div class="flex items-center gap-3">
        <NuxtLink v-if="cta" class="btn hidden !min-h-[46px] sm:inline-flex" :to="cta.url">{{ cta.label }}</NuxtLink>
        <button type="button" class="inline-flex h-12 w-12 items-center justify-center rounded-[14px] bg-paper text-ink lg:hidden" :aria-expanded="menu.open.value" aria-controls="site-menu" :aria-label="menu.open.value ? words.closeMenu : words.openMenu" @click="menu.open.value ? menu.hide() : menu.show()">
          <UIcon :name="menu.open.value ? 'i-lucide-x' : 'i-lucide-menu'" class="size-[22px]" aria-hidden="true" />
        </button>
      </div>
    </div>
    <div v-show="menu.open.value" id="site-menu" class="absolute inset-x-3 top-[calc(100%-4px)] z-40 rounded-[24px] bg-paper p-4 shadow-[0_18px_50px_rgb(20_30_25/0.22)] lg:hidden">
      <nav class="flex flex-col" :aria-label="words.mobileMenu">
        <NuxtLink v-for="(l, i) in links" :key="l.id" class="serif flex min-h-[52px] items-center justify-between px-2 text-[1.45rem] font-bold text-ink" :class="i < links.length - 1 ? 'border-b border-[var(--rule)]' : ''" :to="l.url" @click="menu.hide()">{{ l.label }} <span class="h-3 w-3 rounded-full" :class="DOTS[i % DOTS.length]" aria-hidden="true" /></NuxtLink>
        <NuxtLink v-if="cta" class="btn mt-3" :to="cta.url" @click="menu.hide()">{{ cta.label }}</NuxtLink>
      </nav>
    </div>
  </header>
</template>
