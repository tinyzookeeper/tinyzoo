<script setup lang="ts">
// Cesta's header: the sign on the left, the menu in the middle, the phone number and a pill
// button on the right. Below a desktop's width the menu folds behind a button and opens as a
// soft panel under the header.
const { nav } = await useSite()
const { phone, phoneUrl, cta, words, shortName } = await useGarage()
const links = computed(() => menuLinks(nav.value?.main))
const menu = useOverlayMenu()
</script>

<template>
  <header>
    <div class="wrap flex items-center justify-between gap-6 py-5">
      <NuxtLink to="/" :aria-label="words.toTop(shortName)"><CestaWordmark /></NuxtLink>
      <nav class="hidden lg:flex items-center gap-9" :aria-label="words.mainMenu">
        <NuxtLink v-for="l in links" :key="l.id" class="navlink" :to="l.url" :target="l.newTab ? '_blank' : undefined">{{ l.label }}</NuxtLink>
      </nav>
      <div class="flex items-center gap-5">
        <a v-if="phone" :href="phoneUrl" class="num hidden sm:inline-flex items-center gap-2 font-bold text-[20px] min-h-[44px] hover:text-brand transition-colors"><UIcon name="i-lucide-phone" class="size-[18px]" aria-hidden="true" />{{ phone }}</a>
        <NuxtLink v-if="cta" :to="cta.url" class="btn btn-brand !min-h-[48px] !px-6 !text-[17px] hidden md:inline-flex">{{ cta.label }}</NuxtLink>
        <button type="button" class="lg:hidden grid place-items-center w-12 h-12 rounded-full bg-tint text-[22px] cursor-pointer" :aria-expanded="menu.open.value" aria-controls="site-menu" :aria-label="menu.open.value ? words.menuClose : words.menuOpen" @click="menu.open.value ? menu.hide() : menu.show()">
          <UIcon :name="menu.open.value ? 'i-lucide-x' : 'i-lucide-menu'" class="size-[22px]" aria-hidden="true" />
        </button>
      </div>
    </div>
    <div v-show="menu.open.value" id="site-menu" class="lg:hidden wrap pb-5">
      <nav class="rounded-[24px] bg-paper p-3 flex flex-col font-display font-semibold text-[20px]" :aria-label="words.mobileMenu">
        <NuxtLink v-for="l in links" :key="l.id" class="px-4 py-3.5 rounded-[14px] hover:bg-white" :to="l.url" @click="menu.hide()">{{ l.label }}</NuxtLink>
        <NuxtLink v-if="cta" class="btn btn-brand mt-3" :to="cta.url" @click="menu.hide()">{{ cta.label }}</NuxtLink>
        <a v-if="phone" class="btn btn-white mt-2 num" :href="phoneUrl"><UIcon name="i-lucide-phone" aria-hidden="true" />{{ phone }}</a>
      </nav>
    </div>
  </header>
</template>
