<script setup lang="ts">
// Cedule: a black rule under a thin row: the name in a box, the menu, the phone in mono and a
// black button. Below a desktop's width the menu folds behind a button and opens on the brand
// colour, the links set huge.
const { nav } = await useSite()
const { settings, cta, words } = await useOffice()
const { total } = await useOffer()
const w = words.value.cedule
const links = computed(() => menuLinks(nav.value?.main))
const menu = useOverlayMenu()
// With a long name the menu folds behind its button until the row is wide enough for both.
const long = computed(() => (settings.value?.siteName ?? '').length > 24)
/** The link to the listings carries how many there are, in the phone's menu. */
const isOffer = (url: string) => url.endsWith(`#${words.value.anchors.listings}`)
</script>

<template>
  <header class="border-b-2 border-ink bg-paper">
    <div class="wrap flex items-center justify-between h-[68px] md:h-[76px]">
      <NuxtLink to="/" class="flex min-w-0 items-center gap-3 min-h-[44px]" :aria-label="w.toTop(settings?.siteName ?? '')"><CeduleWordmark /></NuxtLink>
      <nav class="items-center gap-8" :class="long ? 'hidden xl:flex' : 'hidden lg:flex'" :aria-label="words.mainMenu">
        <NuxtLink v-for="l in links" :key="l.id" class="navlink" :to="l.url" :target="l.newTab ? '_blank' : undefined">{{ l.label }}</NuxtLink>
      </nav>
      <div class="items-center gap-6" :class="long ? 'hidden xl:flex' : 'hidden lg:flex'">
        <a v-if="settings?.phone" class="mono num text-[0.85rem] min-h-[44px] inline-flex items-center hover:underline underline-offset-4 decoration-2" :href="telHref(settings.phone)">{{ settings.phone }}</a>
        <NuxtLink v-if="cta" class="btn min-h-[48px]" :to="cta.url">{{ cta.label }}</NuxtLink>
      </div>
      <button type="button" class="shrink-0 inline-flex items-center gap-2 min-h-[44px] px-3 border-2 border-ink font-bold cursor-pointer" :class="long ? 'xl:hidden' : 'lg:hidden'" :aria-expanded="menu.open.value" aria-controls="site-menu" @click="menu.show()">
        <UIcon name="i-lucide-menu" class="size-5" aria-hidden="true" /> {{ words.menu }}
      </button>
    </div>

    <!-- Mobile menu -->
    <div v-show="menu.open.value" id="site-menu" class="fixed inset-0 z-50 bg-brand text-brand-ink overflow-y-auto" :class="long ? 'xl:hidden' : 'lg:hidden'">
      <div class="wrap pb-10">
        <div class="flex items-center justify-between h-[68px]">
          <span aria-hidden="true"><CeduleWordmark plain /></span>
          <button type="button" class="inline-flex items-center gap-2 min-h-[44px] px-3 border-2 border-current font-bold cursor-pointer" @click="menu.hide()">
            <UIcon name="i-lucide-x" class="size-5" aria-hidden="true" /> {{ words.close }}
          </button>
        </div>
        <nav class="mt-4 flex flex-col border-t-2 border-current" :aria-label="words.mobileMenu">
          <NuxtLink v-for="l in links" :key="l.id" class="py-3 border-b-2 border-current font-extrabold text-[2.4rem] leading-none tracking-[-0.04em]" :to="l.url" @click="menu.hide()">{{ l.label }} <sup v-if="isOffer(l.url)" class="mono font-normal tracking-normal">{{ total }}</sup></NuxtLink>
        </nav>
        <NuxtLink v-if="cta" class="btn w-full mt-6" :to="cta.url" @click="menu.hide()">{{ cta.label }}</NuxtLink>
        <p v-if="settings?.hours" class="mt-6 mono caps">{{ w.hours(settings.hours) }}</p>
        <a v-if="settings?.phone" class="mt-1 inline-flex items-center min-h-[44px] font-extrabold text-[1.6rem] tracking-[-0.03em] num" :href="telHref(settings.phone)">{{ settings.phone }}</a>
      </div>
    </div>
  </header>
</template>
