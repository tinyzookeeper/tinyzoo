<script setup lang="ts">
// Deka: the name with its mark of five threads, the menu and a dark button. Below a desktop's
// width the menu folds behind a framed button and opens over a strip of the blanket.
const { nav } = await useSite()
const { settings, name, words, cta, short, tel } = await useStudio()
const links = computed(() => menuLinks(nav.value?.main))
const menu = useOverlayMenu()
// The swatch of a menu entry: the five threads in turn, the sixth entry in the ink.
const swatch = (i: number) => (i % 6 === 5 ? 'bg-ink' : ['th1', 'th2', 'th3', 'th4', 'th5'][i % 6])
</script>

<template>
  <header class="relative z-10">
    <div class="wrap">
      <div class="flex items-center justify-between gap-6 py-5">
        <NuxtLink to="/" class="flex items-center gap-3 text-ink" :aria-label="words.toTop(name)"><DekaWordmark /></NuxtLink>
        <nav class="hidden lg:flex items-center gap-7" :aria-label="words.mainMenu">
          <NuxtLink v-for="l in links" :key="l.id" class="navlink" :to="l.url" :target="l.newTab ? '_blank' : undefined">{{ l.label }}</NuxtLink>
        </nav>
        <div class="flex items-center gap-3">
          <NuxtLink v-if="cta" class="btn hidden sm:inline-flex !min-h-[44px] !px-5 text-[0.95rem]" :to="cta.url">{{ cta.label }}</NuxtLink>
          <button type="button" class="lg:hidden inline-flex items-center justify-center gap-2 h-11 px-3.5 rounded-md text-ink font-semibold shadow-[inset_0_0_0_1.5px_var(--ink)] cursor-pointer" :aria-label="words.openMenu" :aria-expanded="menu.open.value" aria-controls="site-menu" @click="menu.show()">
            <UIcon name="i-lucide-menu" class="size-[1em] text-xl" aria-hidden="true" /> {{ words.menu }}
          </button>
        </div>
      </div>
    </div>

    <!-- Mobile menu -->
    <div v-show="menu.open.value" id="site-menu" class="fixed inset-0 z-50 bg-paper overflow-y-auto lg:hidden" role="dialog" aria-modal="true" :aria-label="words.menu">
      <div class="stripes" />
      <div class="wrap flex items-center justify-between py-5">
        <span class="font-display font-bold text-[1.6rem] leading-none text-ink" aria-hidden="true">{{ name }}</span>
        <button type="button" class="inline-flex items-center justify-center gap-2 h-11 px-3.5 rounded-md text-ink font-semibold shadow-[inset_0_0_0_1.5px_var(--ink)] cursor-pointer" :aria-label="words.closeMenu" @click="menu.hide()"><UIcon name="i-lucide-x" class="size-[1em] text-xl" aria-hidden="true" /> {{ words.close }}</button>
      </div>
      <nav class="wrap pt-2 pb-10" :aria-label="words.mobileMenu">
        <ul class="font-display font-bold text-[1.9rem] leading-tight text-ink">
          <li v-for="(l, i) in links" :key="l.id"><NuxtLink class="flex items-center gap-4 min-h-[60px]" :to="l.url" @click="menu.hide()"><span class="sw" :class="swatch(i)" />{{ l.label }}</NuxtLink></li>
        </ul>
        <NuxtLink v-if="cta" class="btn w-full mt-7" :to="cta.url" @click="menu.hide()">{{ cta.long }}</NuxtLink>
        <p class="mt-6 text-quiet">{{ short }}<template v-if="short && settings?.phone"> · </template><a v-if="settings?.phone" class="text-ink font-semibold" :href="tel">{{ settings.phone }}</a></p>
      </nav>
    </div>
  </header>
</template>
