<script setup lang="ts">
// Zvýrazňovač's header: part of the opening's field of marker colour (the opening continues
// under it), the name on the left, the menu in mono capitals and a black button on the right.
// Below a desktop's width the menu folds behind a button into a black full-screen panel.
const { nav } = await useSite()
const { settings, name, words, cta } = await useProfile()
const links = computed(() => menuLinks(nav.value?.main))
const menu = useOverlayMenu()
</script>

<template>
  <header class="bg-brand text-brand-ink on-brand">
    <div class="wrap flex items-center justify-between h-[72px] lg:h-[84px]">
      <NuxtLink to="/" class="inline-flex items-center min-h-[44px]" :aria-label="words.toTop(name)"><ZvyraznovacWordmark /></NuxtLink>
      <nav class="hidden lg:flex items-center gap-8 mono" :aria-label="words.mainMenu">
        <NuxtLink v-for="l in links" :key="l.id" class="navlink" :to="l.url" :target="l.newTab ? '_blank' : undefined">{{ czText(l.label) }}</NuxtLink>
        <NuxtLink v-if="cta" class="btn !min-h-[46px] !px-5 !text-[0.8rem] !font-medium ml-2" :to="cta.url">{{ cta.label }}</NuxtLink>
      </nav>
      <button type="button" class="lg:hidden inline-flex items-center gap-2 min-h-[44px] pl-4 mono cursor-pointer" :aria-expanded="menu.open.value" aria-controls="site-menu" @click="menu.show()">
        {{ words.menu }} <UIcon name="i-lucide-menu" class="text-[1.3rem]" aria-hidden="true" />
      </button>
    </div>

    <!-- Mobile menu -->
    <div v-show="menu.open.value" id="site-menu" class="fixed inset-0 z-50 bg-ink text-paper on-ink overflow-y-auto lg:hidden">
      <div class="wrap flex items-center justify-between h-[72px]">
        <span class="font-black text-[1.3rem] tracking-[-0.04em]" aria-hidden="true">{{ name }}</span>
        <button type="button" class="inline-flex items-center gap-2 min-h-[44px] pl-4 mono cursor-pointer" @click="menu.hide()">
          {{ words.close }} <UIcon name="i-lucide-x" class="text-[1.3rem]" aria-hidden="true" />
        </button>
      </div>
      <nav class="wrap pt-4 pb-10 flex flex-col" :aria-label="words.mobileMenu">
        <NuxtLink v-for="l in links" :key="l.id" class="font-black text-[2.9rem] tracking-[-0.045em] leading-none py-3" :to="l.url" :target="l.newTab ? '_blank' : undefined" @click="menu.hide()">{{ czText(l.label) }}</NuxtLink>
        <NuxtLink v-if="cta" class="font-black text-[2.9rem] tracking-[-0.045em] leading-none py-3 text-brand" :to="cta.url" @click="menu.hide()">{{ words.contact }}</NuxtLink>
        <NuxtLink v-if="cta" class="btn btn-brand mt-8" :to="cta.url" @click="menu.hide()">{{ words.firstCall }}</NuxtLink>
        <a v-if="settings?.phone" class="mono mt-6 inline-flex items-center min-h-[44px]" :href="telHref(settings.phone)">{{ tidyText(settings.phone) }}</a>
      </nav>
    </div>
  </header>
</template>
