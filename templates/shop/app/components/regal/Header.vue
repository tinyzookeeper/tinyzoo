<script setup lang="ts">
// Regál: a thin dark bar with the opening state, the address and the phone; under it the name
// in heavy type, the menu and one button. Below 1280 px the menu folds behind a button.
const { nav } = await useSite()
const { settings, name, words, week, place, lines, cta } = await useShop()
const links = computed(() => menuLinks(nav.value?.main))
const menu = useOverlayMenu()
const opening = useOpening(week)
const kind = computed(() => slashParts(settings.value?.tagline))
const known = computed(() => (opening.value ? 'known' : 'unknown'))
</script>

<template>
  <header>
    <div class="on-dark bg-ink text-paper">
      <div class="wrap cond flex min-h-11 items-center justify-between gap-6 text-[1.1rem] md:min-h-10">
        <p class="flex items-center gap-2 whitespace-nowrap" :data-state="known"><span class="dot" :data-closed="opening?.open === false" /><span>{{ opening?.open === false ? words.closed : words.open }}</span><span class="opacity-70">{{ opening ? words.openDetail(opening.detail) : '' }}</span></p>
        <p class="hidden whitespace-nowrap md:block"><template v-for="(part, i) in [place, ...lines]" :key="i"><template v-if="i">{{ ' ' }}<span class="mx-2 opacity-50">/</span>{{ ' ' }}</template>{{ part }}</template></p>
        <a v-if="settings?.phone" :href="phoneHref(settings.phone)" class="-mr-2 inline-flex min-h-11 items-center whitespace-nowrap px-2 hover:text-signal md:min-h-10">{{ settings.phone }}</a>
      </div>
    </div>
    <div class="wrap flex items-center justify-between gap-6 py-3 md:py-4">
      <NuxtLink to="/" class="flex min-h-11 items-center gap-3" :aria-label="words.toTop(name)">
        <span class="text-[1.55rem] font-extrabold leading-none tracking-[-0.04em] md:text-[1.8rem]"><RegalWordmark /></span>
        <span v-if="kind.length" class="cond hidden pt-1 text-[1.05rem] opacity-70 sm:inline">{{ kind.join(' / ') }}</span>
      </NuxtLink>
      <nav class="hidden items-center gap-7 xl:flex" :aria-label="words.mainMenu">
        <NuxtLink v-for="l in links" :key="l.id" class="navlink" :to="l.url" :target="l.newTab ? '_blank' : undefined">{{ l.label }}</NuxtLink>
        <NuxtLink v-if="cta" class="btn !min-h-11 !px-5" :to="cta.url">{{ cta.label }}</NuxtLink>
      </nav>
      <button type="button" class="-mr-2 inline-flex min-h-11 items-center gap-2 px-2 font-bold xl:hidden" :aria-expanded="menu.open.value" aria-controls="site-menu" @click="menu.show()">
        {{ words.menu }} <UIcon name="i-lucide-menu" class="text-2xl" aria-hidden="true" />
      </button>
    </div>

    <!-- Mobile menu -->
    <div v-show="menu.open.value" id="site-menu" class="on-rail fixed inset-0 z-50 flex-col overflow-y-auto bg-rail px-5 pb-8 pt-3 text-rail-ink xl:hidden" :class="menu.open.value ? 'flex' : ''" role="dialog" aria-modal="true" :aria-label="words.menu">
      <div class="flex items-center justify-between">
        <span class="text-[1.55rem] font-extrabold leading-none tracking-[-0.04em]" aria-hidden="true">{{ name }}</span>
        <button type="button" class="-mr-2 inline-flex min-h-11 items-center gap-2 px-2 font-bold" @click="menu.hide()">{{ words.close }} <UIcon name="i-lucide-x" class="text-2xl" aria-hidden="true" /></button>
      </div>
      <nav class="mt-8 flex flex-col" :aria-label="words.mobileMenu">
        <NuxtLink v-for="(l, i) in links" :key="l.id" class="border-rail-ink/40 py-3 text-[1.7rem] font-bold tracking-[-0.03em]" :class="i === links.length - 1 ? 'border-y-2' : 'border-t-2'" :to="l.url" @click="menu.hide()">{{ l.label }}</NuxtLink>
      </nav>
      <p class="cond mt-7 flex items-center gap-2 text-[1.3rem]" :data-state="known"><span class="dot" :data-closed="opening?.open === false" /><span>{{ opening?.open === false ? words.closed : words.open }}</span><span>{{ opening ? words.openDetail(opening.detail) : '' }}</span></p>
      <div class="mt-5 grid gap-3">
        <NuxtLink v-if="cta" :to="cta.url" class="btn !bg-ink !text-white" @click="menu.hide()">{{ cta.label }}</NuxtLink>
        <a v-if="settings?.phone" :href="phoneHref(settings.phone)" class="btn !bg-white !text-ink"><UIcon name="i-lucide-phone" aria-hidden="true" /> {{ settings.phone }}</a>
      </div>
    </div>
  </header>
</template>
