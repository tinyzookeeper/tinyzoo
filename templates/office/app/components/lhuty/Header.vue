<script setup lang="ts">
// Lhůty's header: the name on the left, the menu, the phone and one button on the right. Below
// a desktop's width the menu folds behind a button and opens as a panel under the header.
const { nav } = await useSite()
const { name, words, phone, cta } = await useOffice()
const links = computed(() => menuLinks(nav.value?.main))
const menu = useOverlayMenu()
</script>

<template>
  <header class="border-b border-line bg-paper">
    <div class="wrap flex items-center justify-between gap-6 py-4 lg:py-5">
      <NuxtLink to="/" class="flex items-center gap-3" :aria-label="words.toHome(name)"><LhutyWordmark /></NuxtLink>
      <nav class="hidden items-center gap-8 text-[15px] lg:flex" :aria-label="words.mainMenu">
        <NuxtLink v-for="l in links" :key="l.id" class="ulink" :to="l.url" :target="l.newTab ? '_blank' : undefined">{{ l.label }}</NuxtLink>
      </nav>
      <div class="hidden items-center gap-6 lg:flex">
        <a v-if="phone" :href="phone.href" class="num text-[15px] hover:text-signal-text">{{ phone.text }}</a>
        <NuxtLink v-if="cta" :to="cta.url" class="btn btn-brand">{{ cta.label }}</NuxtLink>
      </div>
      <button type="button" class="flex h-12 w-12 cursor-pointer items-center justify-center border border-ink lg:hidden" :aria-expanded="menu.open.value" aria-controls="site-menu" :aria-label="menu.open.value ? words.closeMenu : words.openMenu" @click="menu.open.value ? menu.hide() : menu.show()">
        <UIcon :name="menu.open.value ? 'i-lucide-x' : 'i-lucide-menu'" class="size-[22px]" aria-hidden="true" />
      </button>
    </div>
    <div v-show="menu.open.value" id="site-menu" class="border-t border-line bg-card lg:hidden">
      <nav class="wrap flex flex-col py-2 text-[18px]" :aria-label="words.mobileMenu">
        <NuxtLink v-for="l in links" :key="l.id" class="flex min-h-12 items-center border-b border-line" :to="l.url" @click="menu.hide()">{{ l.label }}</NuxtLink>
        <a v-if="phone" class="num flex min-h-12 items-center" :href="phone.href">{{ phone.text }}</a>
        <NuxtLink v-if="cta" :to="cta.url" class="btn btn-brand my-3 justify-center" @click="menu.hide()">{{ cta.long }}</NuxtLink>
      </nav>
    </div>
  </header>
</template>
