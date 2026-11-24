<script setup lang="ts">
// Čekárna's header: the mark and name on the left, the menu in the middle (a button below a
// wide desktop), the phone as a soft button. The folded menu drops down under the header.
const { nav } = await useSite()
const { settings, name, words, phoneHref } = await useMedical()
const links = computed(() => menuLinks(nav.value?.main))
// The wide menu has the sections of the page; the notices' link is only in the folded one.
const wide = computed(() => links.value.filter((l) => !l.url.endsWith(`#${anchorOf('notices')}`)))
const menu = useOverlayMenu()
// A long name needs the room the wide menu takes: the menu folds behind its button up to a larger width.
const long = computed(() => name.value.length > 26)
</script>

<template>
  <NuxtLink :to="`/#${anchorOf('hours')}`" class="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-3 focus:rounded-xl focus:bg-white focus:px-4 focus:py-3 focus:text-ink focus:shadow-lg">{{ words.skipToHours }}</NuxtLink>
  <header class="relative z-30 bg-white">
    <div class="wrap flex items-center justify-between gap-6 py-4 lg:py-5">
      <NuxtLink to="/" class="flex min-w-0 items-center gap-3 text-ink" :aria-label="words.toTop(name)"><CekarnaWordmark /></NuxtLink>
      <nav class="hidden items-center gap-9 whitespace-nowrap" :class="long ? '2xl:flex' : 'xl:flex'" :aria-label="words.mainMenu">
        <NuxtLink v-for="l in wide" :key="l.id" class="navlink" :to="l.url" :target="l.newTab ? '_blank' : undefined">{{ l.label }}</NuxtLink>
      </nav>
      <div class="flex items-center gap-2">
        <a v-if="phoneHref && settings?.phone" :href="phoneHref" class="btn btn-soft num whitespace-nowrap max-sm:px-3.5 max-sm:min-w-[3.2rem]" :aria-label="words.callAria(settings.phone)">
          <UIcon name="i-lucide-phone" class="ic text-brand" aria-hidden="true" /><span class="max-sm:hidden">{{ settings.phone }}</span>
        </a>
        <button type="button" class="btn btn-soft px-4" :class="long ? '2xl:hidden' : 'xl:hidden'" :aria-expanded="menu.open.value" aria-controls="site-menu" @click="menu.open.value ? menu.hide() : menu.show()">
          <UIcon name="i-lucide-menu" class="ic size-[22px]" aria-hidden="true" /><span>{{ words.menu }}</span>
        </button>
      </div>
    </div>
    <!-- Mobile menu -->
    <div v-show="menu.open.value" id="site-menu" :class="long ? '2xl:hidden' : 'xl:hidden'" class="absolute inset-x-0 top-full bg-white shadow-[0_40px_60px_-30px_rgba(21,34,28,.35)] rounded-b-[24px]">
      <nav class="wrap pb-5 grid" :aria-label="words.mobileMenu">
        <NuxtLink v-for="l in links" :key="l.id" class="flex items-center justify-between py-4 border-t border-line text-ink text-[1.2rem] font-display font-semibold" :to="l.url" @click="menu.hide()">
          {{ l.label }} <UIcon name="i-lucide-arrow-right" class="ic text-brand" aria-hidden="true" />
        </NuxtLink>
      </nav>
    </div>
  </header>
</template>
