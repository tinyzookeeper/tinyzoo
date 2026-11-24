<script setup lang="ts">
// Šanony's header: the name and a short line on the left, the menu, the phone and one button on
// the right. Below a desktop's width the menu folds behind an ink button and opens as a black panel.
const { nav } = await useSite()
const { settings, name, words, phone, cta } = await useOffice()
const links = computed(() => menuLinks(nav.value?.main))
const menu = useOverlayMenu()
</script>

<template>
  <header class="bg-paper">
    <div class="wrap flex items-center justify-between gap-6 py-4 lg:py-5">
      <NuxtLink to="/" class="flex items-baseline gap-3" :aria-label="words.toHome(name)">
        <span class="font-display text-[25px] font-extrabold tracking-[-0.04em]"><SanonyWordmark /></span>
        <span v-if="settings?.tagline" class="hidden text-[13px] font-semibold sm:inline">{{ settings.tagline }}</span>
      </NuxtLink>
      <nav class="hidden items-center gap-8 lg:flex" :aria-label="words.mainMenu">
        <NuxtLink v-for="l in links" :key="l.id" class="navlink" :to="l.url" :target="l.newTab ? '_blank' : undefined">{{ l.label }}</NuxtLink>
      </nav>
      <div class="hidden items-center gap-6 lg:flex">
        <a v-if="phone" :href="phone.href" class="font-display text-[19px] font-bold hover:text-brand">{{ phone.text }}</a>
        <NuxtLink v-if="cta" :to="cta.url" class="btn btn-ink min-h-12 text-[16px]">{{ cta.label }}</NuxtLink>
      </div>
      <button type="button" class="flex h-12 w-12 cursor-pointer items-center justify-center rounded-[3px] bg-ink text-paper lg:hidden" :aria-expanded="menu.open.value" aria-controls="site-menu" :aria-label="menu.open.value ? words.closeMenu : words.openMenu" @click="menu.open.value ? menu.hide() : menu.show()">
        <UIcon :name="menu.open.value ? 'i-lucide-x' : 'i-lucide-menu'" class="size-6" aria-hidden="true" />
      </button>
    </div>
    <div v-show="menu.open.value" id="site-menu" class="on-dark bg-ink text-paper lg:hidden">
      <nav class="wrap flex flex-col py-3" :aria-label="words.mobileMenu">
        <NuxtLink v-for="l in links" :key="l.id" class="flex min-h-14 items-center border-b border-paper/25 font-display text-[26px] font-bold" :to="l.url" @click="menu.hide()">{{ l.label }}</NuxtLink>
        <a v-if="phone" class="flex min-h-14 items-center font-display text-[26px] font-bold" :href="phone.href">{{ phone.text }}</a>
        <NuxtLink v-if="cta" :to="cta.url" class="btn btn-brand my-3" @click="menu.hide()">{{ cta.long }}</NuxtLink>
      </nav>
    </div>
  </header>
</template>
