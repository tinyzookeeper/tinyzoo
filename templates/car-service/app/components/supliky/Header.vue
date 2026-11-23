<script setup lang="ts">
// Šuplíky's header: the hexagon sign on the left, the menu in the middle, the phone number and a
// chunky button on the right. Below a desktop's width the menu folds behind a button and opens as
// a slab under the header.
const { nav } = await useSite()
const { phone, phoneUrl, cta, words, shortName } = await useGarage()
const links = computed(() => menuLinks(nav.value?.main))
const menu = useOverlayMenu()
</script>

<template>
  <header>
    <div class="wrap flex items-center justify-between gap-6 py-4 lg:py-5">
      <NuxtLink to="/" :aria-label="words.toTop(shortName)"><SuplikyWordmark /></NuxtLink>
      <nav class="hidden lg:flex items-center gap-8" :aria-label="words.mainMenu">
        <NuxtLink v-for="l in links" :key="l.id" class="navlink" :to="l.url" :target="l.newTab ? '_blank' : undefined">{{ l.label }}</NuxtLink>
      </nav>
      <div class="flex items-center gap-3">
        <a v-if="phone" :href="phoneUrl" class="num hidden sm:inline-flex items-center gap-2 text-[22px] min-h-[46px] px-2 hover:text-brand transition-colors"><UIcon name="i-lucide-phone" class="size-[19px]" aria-hidden="true" />{{ phone }}</a>
        <NuxtLink v-if="cta" :to="cta.url" class="btn btn-brand !min-h-[46px] !text-[18px] !px-5 hidden md:inline-flex">{{ cta.label }}</NuxtLink>
        <button type="button" class="lg:hidden grid place-items-center w-12 h-12 rounded-[14px] bg-ink text-white text-[24px] cursor-pointer" :aria-expanded="menu.open.value" aria-controls="site-menu" :aria-label="menu.open.value ? words.menuClose : words.menuOpen" @click="menu.open.value ? menu.hide() : menu.show()">
          <UIcon :name="menu.open.value ? 'i-lucide-x' : 'i-lucide-menu'" class="size-6" aria-hidden="true" />
        </button>
      </div>
    </div>
    <div v-show="menu.open.value" id="site-menu" class="lg:hidden wrap pb-4">
      <nav class="slab p-3 flex flex-col text-[19px] font-medium" :aria-label="words.mobileMenu">
        <NuxtLink v-for="l in links" :key="l.id" class="px-3 py-3 border-b-2 border-tint" :to="l.url" @click="menu.hide()">{{ l.label }}</NuxtLink>
        <NuxtLink v-if="cta" class="btn btn-brand mt-3 mb-2" :to="cta.url" @click="menu.hide()">{{ cta.label }}</NuxtLink>
        <a v-if="phone" class="btn btn-ink mt-2 mb-2 !not-italic" :href="phoneUrl">{{ phone }}</a>
      </nav>
    </div>
  </header>
</template>
