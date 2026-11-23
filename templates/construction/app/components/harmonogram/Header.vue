<script setup lang="ts">
// Harmonogram's header: a hairline under a sticky graphite bar, the name, the menu in mono
// capitals, the phone and the green button. Below a wide desktop the menu folds behind a
// button and opens as a full screen of large headings.
const { nav } = await useSite()
const { settings, words, tel, cta, noteOf } = await useFirm()
const links = computed(() => menuLinks(nav.value?.main))
const menu = useOverlayMenu()
</script>

<template>
  <header class="sticky top-0 z-40 border-b border-line bg-bg">
    <div class="wrap flex h-[68px] items-center justify-between gap-6">
      <NuxtLink to="/" class="flex min-w-0 items-center gap-3 text-text"><HarmonogramWordmark /></NuxtLink>
      <nav class="hidden items-center gap-7 xl:flex" :aria-label="words.mainMenu">
        <NuxtLink v-for="l in links" :key="l.id" class="mono !text-text hover:!text-brand" :to="l.url" :target="l.newTab ? '_blank' : undefined">{{ l.label }}</NuxtLink>
      </nav>
      <div class="flex shrink-0 items-center gap-5">
        <a v-if="tel && settings?.phone" :href="tel" class="num hidden whitespace-nowrap text-[15px] font-medium text-text hover:text-brand sm:block">{{ settings.phone }}</a>
        <NuxtLink v-if="cta" :to="cta.url" class="btn btn-brand hidden !min-h-[44px] whitespace-nowrap !px-5 !text-[15px] sm:inline-flex">{{ cta.label }}</NuxtLink>
        <button type="button" class="flex h-11 w-11 shrink-0 items-center justify-center border border-line text-text xl:hidden" :aria-label="words.openMenu" aria-controls="site-menu" :aria-expanded="menu.open.value" @click="menu.show()">
          <UIcon name="i-lucide-menu" class="size-[22px]" aria-hidden="true" />
        </button>
      </div>
    </div>

    <!-- Mobile menu -->
    <div v-show="menu.open.value" id="site-menu" class="fixed inset-0 z-50 overflow-y-auto bg-bg xl:hidden">
      <div class="wrap flex h-[68px] items-center justify-between border-b border-line">
        <span class="text-[20px] font-extrabold tracking-[-.03em] text-text" aria-hidden="true">{{ settings?.siteName }}</span>
        <button type="button" class="flex h-11 w-11 shrink-0 items-center justify-center border border-line text-text" :aria-label="words.closeMenu" @click="menu.hide()">
          <UIcon name="i-lucide-x" class="size-[22px]" aria-hidden="true" />
        </button>
      </div>
      <nav class="wrap pt-2" :aria-label="words.mobileMenu">
        <NuxtLink v-for="l in links" :key="l.id" class="flex min-h-[64px] items-center justify-between border-b border-line text-[30px] font-extrabold tracking-[-.03em] text-text" :to="l.url" @click="menu.hide()">
          {{ l.label }} <span v-if="noteOf(l.url)" class="mono" :class="l.url === `/#${words.anchors.building}` ? '!text-brand' : ''">{{ noteOf(l.url) }}</span>
        </NuxtLink>
        <NuxtLink v-if="cta" :to="cta.url" class="btn btn-brand mt-8 w-full" @click="menu.hide()">{{ cta.label }}</NuxtLink>
        <a v-if="tel && settings?.phone" :href="tel" class="btn btn-ghost num mt-3 w-full">{{ settings.phone }}</a>
      </nav>
    </div>
  </header>
</template>
