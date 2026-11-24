<script setup lang="ts">
// Portál: a thin bar with the opening state and the phone, the name board over the shop
// window, and the menu under it. Below a desktop's width the menu folds behind a button.
const { nav } = await useSite()
const { settings, name, words, week } = await useShop()
const links = computed(() => menuLinks(nav.value?.main))
const menu = useOverlayMenu()
const opening = useOpening(week)
// A long name steps down in size and may take two lines on the board.
const nameSize = computed(() => byLength(name.value, [
  [14, 'text-[clamp(1.75rem,8.6vw,5.4rem)] lg:text-[clamp(3.4rem,5.9vw,5.4rem)]'],
  [24, 'text-[clamp(1.4rem,6.4vw,3.6rem)] lg:text-[clamp(2.4rem,3.6vw,3.6rem)]'],
  [34, 'text-[clamp(1.2rem,5.2vw,3rem)] lg:text-[clamp(2rem,3vw,3rem)]'],
], 'text-[clamp(1rem,4.4vw,2.4rem)] lg:text-[clamp(1.6rem,2.4vw,2.4rem)]'))
const kind = computed(() => slashParts(settings.value?.tagline))
</script>

<template>
  <header class="relative z-30">
    <div class="wrap flex items-center justify-between gap-4 py-2">
      <p class="caps flex items-center gap-2 text-cream/80" :data-state="opening ? 'known' : 'unknown'">
        <span class="inline-block size-2 rounded-full" :class="opening?.open === false ? 'ring-1 ring-cream/70' : 'bg-brass'" />
        <span><span>{{ opening?.open === false ? words.closed : words.open }}</span><span class="hidden sm:inline">, <span>{{ opening ? words.openDetail(opening.detail) : '' }}</span></span></span>
      </p>
      <div class="flex items-center gap-5">
        <a v-if="settings?.phone" :href="phoneHref(settings.phone)" class="navlink hidden sm:inline-flex !tracking-[0.12em] !text-[0.86rem]"><UIcon name="i-lucide-phone" class="mr-2 text-brass" aria-hidden="true" />{{ settings.phone }}</a>
        <button type="button" class="caps -mr-2 inline-flex min-h-11 items-center gap-2 px-2 text-cream lg:hidden" :aria-expanded="menu.open.value" aria-controls="site-menu" @click="menu.show()">
          <UIcon name="i-lucide-menu" class="text-xl" aria-hidden="true" /> {{ words.menu }}
        </button>
      </div>
    </div>
    <div class="fascia">
      <div class="wrap flex items-center justify-center gap-6 py-5 md:py-7 lg:justify-between">
        <span class="caps hidden w-44 text-brass lg:block">{{ kind[0] }}</span>
        <NuxtLink to="/" class="fascia-name inline-flex min-h-11 min-w-0 items-center !whitespace-normal text-center" :class="nameSize" :aria-label="words.toTop(name)"><PortalWordmark /></NuxtLink>
        <span class="caps hidden w-44 text-right text-brass lg:block">{{ kind[1] }}</span>
      </div>
    </div>
    <nav class="wrap hidden items-center justify-center gap-10 py-1 lg:flex" :aria-label="words.mainMenu">
      <NuxtLink v-for="l in links" :key="l.id" class="navlink" :to="l.url" :target="l.newTab ? '_blank' : undefined">{{ l.label }}</NuxtLink>
    </nav>

    <!-- Mobile menu -->
    <div v-show="menu.open.value" id="site-menu" class="fixed inset-0 z-50 flex-col overflow-y-auto bg-wood-lo px-5 pb-8 pt-3 lg:hidden" :class="menu.open.value ? 'flex' : ''" role="dialog" aria-modal="true" :aria-label="words.menu">
      <div class="flex items-center justify-between">
        <span class="fascia-name min-w-0 !whitespace-normal text-xl" aria-hidden="true">{{ name }}</span>
        <button type="button" class="caps -mr-2 inline-flex min-h-11 items-center gap-2 px-2 text-cream" @click="menu.hide()"><UIcon name="i-lucide-x" class="text-xl" aria-hidden="true" /> {{ words.close }}</button>
      </div>
      <nav class="mt-6 flex flex-col border-t border-brass/30" :aria-label="words.mobileMenu">
        <NuxtLink v-for="l in links" :key="l.id" class="border-b border-brass/30 py-4 font-display text-2xl" :to="l.url" @click="menu.hide()">{{ l.label }}</NuxtLink>
      </nav>
      <p class="mt-6 text-cream/80" :data-state="opening ? 'known' : 'unknown'">{{ opening?.open === false ? words.closed : words.open }}, {{ opening ? words.openDetail(opening.detail) : '' }}<br>{{ [settings?.address, settings?.town].filter(Boolean).join(', ') }}</p>
      <a v-if="settings?.phone" :href="phoneHref(settings.phone)" class="btn mt-5"><UIcon name="i-lucide-phone" aria-hidden="true" /> {{ settings.phone }}</a>
    </div>
  </header>
</template>
