<script setup lang="ts">
// Sál: the name on the left, the menu in the middle, the phone and the button on the right.
// Below a desktop's width the menu folds behind a round button.
const { nav } = await useSite()
const { settings, name, words, cta, short, tel } = await useStudio()
const links = computed(() => menuLinks(nav.value?.main))
const menu = useOverlayMenu()
</script>

<template>
  <header class="relative z-10">
    <div class="wrap">
      <div class="flex items-center justify-between gap-6 py-5">
        <NuxtLink to="/" class="flex items-baseline gap-2 text-ink" :aria-label="words.toTop(name)"><SalWordmark /></NuxtLink>
        <nav class="hidden lg:flex items-center gap-8" :aria-label="words.mainMenu">
          <NuxtLink v-for="l in links" :key="l.id" class="navlink" :to="l.url" :target="l.newTab ? '_blank' : undefined">{{ l.label }}</NuxtLink>
        </nav>
        <div class="flex items-center gap-3">
          <a v-if="settings?.phone" class="navlink hidden xl:inline-flex tabular-nums" :href="tel">{{ settings.phone }}</a>
          <NuxtLink v-if="cta" class="btn hidden sm:inline-flex !min-h-[44px] !px-5 text-[0.95rem]" :to="cta.url">{{ cta.label }}</NuxtLink>
          <button type="button" class="lg:hidden inline-flex items-center justify-center w-11 h-11 rounded-full text-ink shadow-[inset_0_0_0_1px_var(--line)] cursor-pointer" :aria-label="words.openMenu" :aria-expanded="menu.open.value" aria-controls="site-menu" @click="menu.show()">
            <UIcon name="i-lucide-menu" class="size-[1em] text-xl" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>

    <!-- Mobile menu -->
    <div v-show="menu.open.value" id="site-menu" class="fixed inset-0 z-50 bg-paper overflow-y-auto lg:hidden" role="dialog" aria-modal="true" :aria-label="words.menu">
      <div class="wrap flex items-center justify-between py-5">
        <span class="flex items-baseline gap-2 text-ink" aria-hidden="true"><SalWordmark plain /></span>
        <button type="button" class="inline-flex items-center justify-center w-11 h-11 rounded-full text-ink shadow-[inset_0_0_0_1px_var(--line)] cursor-pointer" :aria-label="words.closeMenu" @click="menu.hide()">
          <UIcon name="i-lucide-x" class="size-[1em] text-xl" aria-hidden="true" />
        </button>
      </div>
      <nav class="wrap pt-4 pb-10" :aria-label="words.mobileMenu">
        <ul class="font-display text-[2rem] leading-tight text-ink divide-y divide-line border-y border-line">
          <li v-for="l in links" :key="l.id"><NuxtLink class="flex items-center min-h-[64px]" :to="l.url" @click="menu.hide()">{{ l.label }}</NuxtLink></li>
        </ul>
        <NuxtLink v-if="cta" class="btn w-full mt-8" :to="cta.url" @click="menu.hide()">{{ cta.long }}</NuxtLink>
        <p class="mt-6 text-quiet">{{ short }}<template v-if="short && settings?.phone"> · </template><a v-if="settings?.phone" class="text-ink" :href="tel">{{ settings.phone }}</a></p>
      </nav>
    </div>
  </header>
</template>
