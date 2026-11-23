<script setup lang="ts">
// Šachovnice: the brand colour from the very top (the opening carries it on), a checkerboard
// tile and the name in lowercase, the menu, the phone and a black booking button. Below a
// desktop's width the menu folds behind a button.
const { nav } = await useSite()
const { name, words, phone } = await useSalon()
const links = computed(() => menuLinks(nav.value?.main))
const menu = useOverlayMenu()
</script>

<template>
  <header class="bg-brand text-brand-ink">
    <div class="wrap flex items-center justify-between py-5">
      <NuxtLink to="/" :aria-label="words.toTop(name)"><SachovniceWordmark /></NuxtLink>
      <nav class="hidden lg:flex items-center gap-8 font-bold" :aria-label="words.mainMenu">
        <NuxtLink v-for="l in links" :key="l.id" :to="l.url" :target="l.newTab ? '_blank' : undefined" class="py-2 border-b-2 border-transparent hover:border-ink">{{ l.label }}</NuxtLink>
      </nav>
      <div class="flex items-center gap-2">
        <a v-if="phone" :href="phone.href" class="hidden md:inline-flex items-center gap-2 min-h-11 px-3 font-extrabold"><UIcon name="i-lucide-phone" aria-hidden="true" />{{ phone.text }}</a>
        <NuxtLink :to="`/#${anchorOf('booking')}`" class="btn btn-ink hidden sm:inline-flex !min-h-11 !px-5 !text-[13px]">{{ words.order }}</NuxtLink>
        <button type="button" class="lg:hidden inline-flex items-center justify-center w-11 h-11 bg-ink text-paper text-xl cursor-pointer" :aria-label="words.openMenu" aria-controls="site-menu" :aria-expanded="menu.open.value" @click="menu.show()"><UIcon name="i-lucide-menu" aria-hidden="true" /></button>
      </div>
    </div>
  </header>

  <!-- Mobile menu -->
  <div v-show="menu.open.value" id="site-menu" class="on-ink fixed inset-0 z-50 bg-ink text-paper overflow-y-auto lg:hidden" role="dialog" aria-modal="true" :aria-label="words.menu">
    <div class="wrap flex items-center justify-between py-5">
      <span aria-hidden="true"><SachovniceWordmark /></span>
      <button type="button" class="inline-flex items-center justify-center w-11 h-11 bg-paper text-ink text-xl cursor-pointer" :aria-label="words.closeMenu" @click="menu.hide()"><UIcon name="i-lucide-x" aria-hidden="true" /></button>
    </div>
    <nav class="wrap pt-6 pb-10" :aria-label="words.mobileMenu">
      <ul class="font-display font-extrabold text-[36px] leading-none tracking-[-0.02em]">
        <li v-for="(l, i) in links" :key="l.id"><NuxtLink class="block py-4 border-paper/30" :class="i === links.length - 1 ? 'border-y-2' : 'border-t-2'" :to="l.url" @click="menu.hide()">{{ l.label }}</NuxtLink></li>
      </ul>
      <div class="mt-8 grid gap-3">
        <NuxtLink :to="`/#${anchorOf('booking')}`" class="btn bg-brand text-brand-ink !border-brand" @click="menu.hide()">{{ words.book }}</NuxtLink>
        <a v-if="phone" :href="phone.href" class="btn !border-paper text-paper"><UIcon name="i-lucide-phone" aria-hidden="true" />{{ phone.text }}</a>
      </div>
    </nav>
  </div>
</template>
