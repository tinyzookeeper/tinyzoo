<script setup lang="ts">
// Tabule: a bar in the studio's colour, the name in capitals, the menu in mono type and the
// button in the accent colour. Below a desktop's width the menu folds behind a framed button.
const { nav } = await useSite()
const { settings, name, words, cta, short, tel } = await useStudio()
const links = computed(() => menuLinks(nav.value?.main))
const menu = useOverlayMenu()
// A longer name steps down and may wrap, so it never pushes the buttons off the screen; the demo's own name is the first step.
const size = computed(() => byLength(name.value, [[12, 'text-[1.6rem] leading-none'], [24, 'text-[1.2rem] leading-[1.05]']], 'text-[0.95rem] leading-[1.05]'))
</script>

<template>
  <header class="on-brand bg-brand text-brand-ink relative z-10">
    <div class="wrap flex items-center justify-between gap-6 h-[72px]">
      <NuxtLink to="/" class="display min-w-0 break-words" :class="size" :aria-label="words.toTop(name)"><TabuleWordmark /></NuxtLink>
      <nav class="mono hidden lg:flex items-center gap-8" :aria-label="words.mainMenu">
        <NuxtLink v-for="l in links" :key="l.id" class="navlink" :to="l.url" :target="l.newTab ? '_blank' : undefined">{{ l.label }}</NuxtLink>
      </nav>
      <div class="flex items-center gap-2 shrink-0">
        <NuxtLink v-if="cta" class="btn !min-h-[44px] !px-4 !text-[0.85rem] hidden sm:inline-flex" :to="cta.url">{{ cta.label }}</NuxtLink>
        <button type="button" class="lg:hidden inline-flex items-center justify-center gap-2 h-11 px-3 border-2 border-brand-ink mono cursor-pointer" :aria-label="words.openMenu" :aria-expanded="menu.open.value" aria-controls="site-menu" @click="menu.show()">
          {{ words.menu }} <UIcon name="i-lucide-menu" class="size-[1em] text-lg" aria-hidden="true" />
        </button>
      </div>
    </div>

    <!-- Mobile menu -->
    <div v-show="menu.open.value" id="site-menu" class="on-brand fixed inset-0 z-50 bg-brand text-brand-ink overflow-y-auto lg:hidden" role="dialog" aria-modal="true" :aria-label="words.menu">
      <div class="wrap flex items-center justify-between h-[72px]">
        <span class="display min-w-0 break-words" :class="size" aria-hidden="true"><TabuleWordmark /></span>
        <button type="button" class="inline-flex items-center justify-center gap-2 h-11 px-3 border-2 border-brand-ink mono cursor-pointer shrink-0" :aria-label="words.closeMenu" @click="menu.hide()">{{ words.close }} <UIcon name="i-lucide-x" class="size-[1em] text-lg" aria-hidden="true" /></button>
      </div>
      <nav class="wrap pt-6 pb-10" :aria-label="words.mobileMenu">
        <ul class="display text-[2.05rem] leading-none">
          <li v-for="(l, i) in links" :key="l.id" class="border-brand-ink" :class="i === links.length - 1 ? 'border-y-2' : 'border-t-2'"><NuxtLink class="flex items-center min-h-[68px]" :to="l.url" @click="menu.hide()">{{ l.label }}</NuxtLink></li>
        </ul>
        <NuxtLink v-if="cta" class="btn w-full mt-8" :to="cta.url" @click="menu.hide()">{{ cta.long }} <UIcon name="i-lucide-arrow-right" class="ico size-[1em]" aria-hidden="true" /></NuxtLink>
        <p class="mono mt-6">{{ short }}<template v-if="short && settings?.phone"> · </template><a v-if="settings?.phone" :href="tel">{{ settings.phone }}</a></p>
      </nav>
    </div>
  </header>
</template>
