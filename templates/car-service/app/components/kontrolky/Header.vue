<script setup lang="ts">
// Kontrolky's header: the gauge sign on the left, the menu in the middle and the phone number in
// the brand colour on the right. Below a desktop's width the menu folds behind a button and opens
// as a dark panel under the header.
const { nav } = await useSite()
const { phone, phoneUrl, cta, words, shortName } = await useGarage()
const links = computed(() => menuLinks(nav.value?.main))
const menu = useOverlayMenu()
</script>

<template>
  <header>
    <div class="wrap flex items-center justify-between gap-6 py-5">
      <NuxtLink to="/" :aria-label="words.toTop(shortName)"><KontrolkyWordmark /></NuxtLink>
      <nav class="hidden lg:flex items-center gap-9" :aria-label="words.mainMenu">
        <NuxtLink v-for="l in links" :key="l.id" class="navlink" :to="l.url" :target="l.newTab ? '_blank' : undefined">{{ l.label }}</NuxtLink>
      </nav>
      <div class="flex items-center gap-4">
        <a v-if="phone" :href="phoneUrl" class="dig hidden sm:inline-flex items-center gap-2.5 min-h-[46px] font-semibold text-[21px] text-brand hover:text-white transition-colors"><UIcon name="i-lucide-phone" class="size-[18px]" aria-hidden="true" />{{ phone }}</a>
        <button type="button" class="lg:hidden grid place-items-center w-12 h-12 rounded-[12px] bg-panel text-[22px] cursor-pointer" :aria-expanded="menu.open.value" aria-controls="site-menu" :aria-label="menu.open.value ? words.menuClose : words.menuOpen" @click="menu.open.value ? menu.hide() : menu.show()">
          <UIcon :name="menu.open.value ? 'i-lucide-x' : 'i-lucide-menu'" class="size-[22px]" aria-hidden="true" />
        </button>
      </div>
    </div>
    <div v-show="menu.open.value" id="site-menu" class="lg:hidden wrap pb-5">
      <nav class="rounded-[18px] bg-panel p-3 flex flex-col font-display font-medium text-[20px]" :aria-label="words.mobileMenu">
        <NuxtLink v-for="(l, i) in links" :key="l.id" class="px-4 py-3.5" :class="i ? 'border-t border-line' : ''" :to="l.url" @click="menu.hide()">{{ l.label }}</NuxtLink>
        <NuxtLink v-if="cta" class="btn btn-brand mt-3" :to="cta.url" @click="menu.hide()">{{ cta.label }}</NuxtLink>
        <a v-if="phone" class="btn mt-2 dig text-brand" :href="phoneUrl"><UIcon name="i-lucide-phone" aria-hidden="true" />{{ phone }}</a>
      </nav>
    </div>
  </header>
</template>
