<script setup lang="ts">
// Zrcadlo: the name and what the salon is on the left, the menu in the middle, the phone and
// the booking button on the right. Below a desktop's width the menu folds behind a button.
const { nav } = await useSite()
const { settings, name, words, days, phone, street, townName, range } = await useSalon()
const links = computed(() => menuLinks(nav.value?.main))
const menu = useOverlayMenu()
const today = useToday()
// "Šípková 59, Jičín · po–so": the week until the browser says which day it is, then today.
const now = useOpenNow(days, today)
const todayText = computed(() => (now.value ? words.value.zrcadlo.today(now.value) : range.value ? words.value.zrcadlo.menuWeek(...range.value) : ''))
</script>

<template>
  <header class="wrap flex items-center justify-between py-5 md:py-7">
    <NuxtLink to="/" class="flex items-baseline gap-3 min-h-11 pt-2" :aria-label="words.toTop(name)">
      <ZrcadloWordmark />
      <span v-if="settings?.tagline && name.length <= 20" class="label hidden sm:inline lg:hidden xl:inline whitespace-nowrap">{{ settings.tagline }}</span>
    </NuxtLink>
    <nav class="hidden lg:flex items-center gap-7 xl:gap-9 text-[15px] font-medium text-ink whitespace-nowrap" :aria-label="words.mainMenu">
      <NuxtLink v-for="l in links" :key="l.id" :to="l.url" :target="l.newTab ? '_blank' : undefined" class="hover:text-brand">{{ l.label }}</NuxtLink>
    </nav>
    <div class="flex items-center gap-3">
      <a v-if="phone" :href="phone.href" class="hidden md:inline-flex items-center gap-2 min-h-11 px-2 text-[15px] font-semibold text-ink hover:text-brand whitespace-nowrap"><UIcon name="i-lucide-phone" aria-hidden="true" />{{ phone.text }}</a>
      <NuxtLink :to="`/#${anchorOf('booking')}`" class="btn btn-brand hidden sm:inline-flex !min-h-11 !px-6 !text-[15px] whitespace-nowrap">{{ words.book }}</NuxtLink>
      <button type="button" class="lg:hidden inline-flex items-center justify-center w-11 h-11 rounded-full shadow-[inset_0_0_0_1px_var(--ink)] text-ink text-xl cursor-pointer" :aria-label="words.openMenu" aria-controls="site-menu" :aria-expanded="menu.open.value" @click="menu.show()"><UIcon name="i-lucide-menu" aria-hidden="true" /></button>
    </div>
  </header>

  <!-- Mobile menu -->
  <div v-show="menu.open.value" id="site-menu" class="fixed inset-0 z-50 bg-paper overflow-y-auto lg:hidden" role="dialog" aria-modal="true" :aria-label="words.menu">
    <div class="wrap flex items-center justify-between py-5">
      <span aria-hidden="true"><ZrcadloWordmark /></span>
      <button type="button" class="inline-flex items-center justify-center w-11 h-11 rounded-full shadow-[inset_0_0_0_1px_var(--ink)] text-ink text-xl cursor-pointer" :aria-label="words.closeMenu" @click="menu.hide()"><UIcon name="i-lucide-x" aria-hidden="true" /></button>
    </div>
    <nav class="wrap pt-4 pb-10" :aria-label="words.mobileMenu">
      <ul class="font-display text-[34px] leading-none text-ink">
        <li v-for="l in links" :key="l.id"><NuxtLink class="block py-4" :to="l.url" @click="menu.hide()">{{ l.label }}</NuxtLink></li>
      </ul>
      <div class="mt-8 grid gap-3">
        <NuxtLink :to="`/#${anchorOf('booking')}`" class="btn btn-brand" @click="menu.hide()">{{ words.book }}</NuxtLink>
        <a v-if="phone" :href="phone.href" class="btn btn-line"><UIcon name="i-lucide-phone" aria-hidden="true" />{{ phone.text }}</a>
      </div>
      <p class="mt-8 text-sm text-quiet">{{ [settings?.address ? `${street[0]} ${street[1]}`.trim() : '', townName].filter(Boolean).join(', ') }} · <span>{{ todayText }}</span></p>
    </nav>
  </div>
</template>
