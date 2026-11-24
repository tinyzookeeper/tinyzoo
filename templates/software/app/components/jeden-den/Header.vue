<script setup lang="ts">
// One Day's header: the name on the dawn, the menu as plain links, sign-in and an outlined button.
// Below a desktop's width the menu folds behind a button and opens as a card; each link carries the
// time of the section it leads to, as the page's rail does.
const { nav } = await useSite()
const { name, words, cta, login } = await useSoftware()
const links = computed(() => menuLinks(nav.value?.main))
const menu = useOverlayMenu()
const home = await useHomeSections()
// "/#cenik" → the time written beside that section ("12:00"); nothing when the section has none
const timeOf = (url: string) => {
  const id = url.split('#')[1]
  return home.value.find((s) => s.time && anchorOf(s.type) === id)?.time ?? ''
}
</script>

<template>
  <header class="bg-dawn">
    <div class="wrap flex h-[76px] items-center justify-between gap-6">
      <NuxtLink to="/" class="flex items-center gap-2.5" :aria-label="words.toTop(name)"><JedenDenWordmark /></NuxtLink>
      <nav class="hidden items-center gap-8 text-[16px] font-medium lg:flex" :aria-label="words.mainMenu">
        <SiteLink v-for="l in links" :key="l.id" class="ul decoration-transparent" :to="l.url">{{ l.label }}</SiteLink>
      </nav>
      <div class="hidden items-center gap-6 lg:flex">
        <SiteLink v-if="login" class="ul text-[16px] font-medium decoration-transparent" :to="login.url">{{ login.label }}</SiteLink>
        <SiteLink v-if="cta" class="btn btn-line !min-h-[46px] !px-5 !text-[16px]" :to="cta.url">{{ cta.label }}</SiteLink>
      </div>
      <button type="button" class="-mr-2 inline-flex h-12 w-12 cursor-pointer items-center justify-center lg:hidden" :aria-expanded="menu.open.value" aria-controls="site-menu" :aria-label="menu.open.value ? words.closeMenu : words.openMenu" @click="menu.open.value ? menu.hide() : menu.show()">
        <UIcon :name="menu.open.value ? 'i-lucide-x' : 'i-lucide-menu'" class="size-7" aria-hidden="true" />
      </button>
    </div>
    <div v-show="menu.open.value" id="site-menu" class="lg:hidden">
      <nav class="wrap pb-5" :aria-label="words.mobileMenu">
        <div class="card flex flex-col p-3 text-[19px] font-medium">
          <SiteLink v-for="l in links" :key="l.id" class="flex min-h-[50px] items-center rounded-xl px-4 hover:bg-morning" :to="l.url" @click="menu.hide()"><span class="time mr-4 w-12 opacity-70">{{ timeOf(l.url) }}</span>{{ l.label }}</SiteLink>
          <SiteLink v-if="login" class="flex min-h-[50px] items-center rounded-xl px-4 hover:bg-morning" :to="login.url"><span class="mr-4 w-12" />{{ login.label }}</SiteLink>
          <SiteLink v-if="cta" class="btn btn-brand mt-2" :to="cta.url" @click="menu.hide()">{{ tidyText(cta.longLabel) }}</SiteLink>
        </div>
      </nav>
    </div>
  </header>
</template>
