<script setup lang="ts">
// Magazín: the menu on the left of a white page. When the page opens with the invitation, the
// header lies over the cover: the menu over its white half, the button in white over the
// photograph. Below a desktop's width the monogram and the menu's button.
const { nav } = await useSite()
const { settings, names, cta, day, words } = await useWedding()
const { page } = await useSitePage()
const links = computed(() => menuLinks(nav.value?.main))
const overCover = computed(() => page.value?.sections[0]?.type === 'invitation')
const menu = useOverlayMenu()
</script>

<template>
  <header class="relative z-10">
    <div class="pad flex items-center justify-between h-[68px] lg:h-[92px]">
      <NuxtLink to="/" class="serif text-ink text-[1.35rem] leading-none min-h-[44px] inline-flex items-center" :class="overCover ? 'lg:hidden' : 'lg:mr-10'" :aria-label="words.toTop(names)"><MagazinWordmark /></NuxtLink>
      <nav class="hidden lg:flex items-center gap-6 xl:gap-8 label" :class="overCover ? '' : 'mr-auto'" :aria-label="words.mainMenu">
        <NuxtLink v-for="l in links" :key="l.id" class="navlink" :to="l.url" :target="l.newTab ? '_blank' : undefined">{{ l.label }}</NuxtLink>
      </nav>
      <NuxtLink v-if="cta && !overCover" class="btn btn-line label !min-h-[48px] !px-7 max-lg:hidden" :to="cta.url">{{ cta.label }}</NuxtLink>
      <button type="button" class="lg:hidden label text-ink inline-flex items-center gap-2 min-h-[44px] pl-4 cursor-pointer" :aria-expanded="menu.open.value" aria-controls="site-menu" @click="menu.show()">
        {{ words.menu }} <UIcon name="i-lucide-menu" class="size-[1.125rem]" aria-hidden="true" />
      </button>
    </div>
    <NuxtLink v-if="cta && overCover" class="btn btn-white label !min-h-[48px] !px-7 absolute top-6 right-6 xl:right-10 max-lg:hidden" :to="cta.url">{{ cta.label }}</NuxtLink>

    <!-- Mobile menu -->
    <div v-show="menu.open.value" id="site-menu" class="fixed inset-0 z-50 bg-paper flex flex-col overflow-y-auto lg:hidden">
      <div class="pad w-full flex items-center justify-between h-[68px] shrink-0">
        <span class="serif text-ink text-[1.35rem] leading-none"><MagazinWordmark /></span>
        <button type="button" class="label text-ink inline-flex items-center gap-2 min-h-[44px] pl-4 cursor-pointer" @click="menu.hide()">
          {{ words.close }} <UIcon name="i-lucide-x" class="size-[1.125rem]" aria-hidden="true" />
        </button>
      </div>
      <nav class="pad flex-1 flex flex-col justify-center py-6 serif display text-ink text-[2.3rem] leading-none" :aria-label="words.mobileMenu">
        <NuxtLink v-for="l in links" :key="l.id" class="min-h-[60px] inline-flex items-center border-b border-line" :to="l.url" @click="menu.hide()">{{ l.label }}</NuxtLink>
        <NuxtLink v-if="cta" class="btn label font-sans mt-8" :to="cta.url" @click="menu.hide()">{{ cta.label }}</NuxtLink>
      </nav>
      <p v-if="day || settings?.venueArea" class="pad label text-quiet pb-8">{{ [day?.date, beforeComma(settings?.venueArea)].filter(Boolean).join(' · ') }}</p>
    </div>
  </header>
</template>
