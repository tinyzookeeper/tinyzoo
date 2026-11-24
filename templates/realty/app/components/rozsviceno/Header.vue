<script setup lang="ts">
// Rozsvíceno: the name after a small lit window, the menu, the phone with a lamp-coloured
// icon and an outlined button. Below a desktop's width the menu folds behind a pill and opens
// as a stack of rounded rows.
const { nav } = await useSite()
const { settings, cta, words } = await useOffice()
const { total } = await useOffer()
const w = words.value.rozsviceno
const links = computed(() => menuLinks(nav.value?.main))
const menu = useOverlayMenu()
// With a long name the menu folds behind its button until the row is wide enough for both.
const long = computed(() => (settings.value?.siteName ?? '').length > 24)
/** The link to the listings carries how many there are, in the phone's menu. */
const isOffer = (url: string) => url.endsWith(`#${words.value.anchors.listings}`)
</script>

<template>
  <header class="wrap">
    <div class="flex items-center justify-between gap-4 h-[72px] md:h-[88px]">
      <NuxtLink to="/" class="flex min-w-0 items-center gap-3 min-h-[44px]" :aria-label="w.toTop(settings?.siteName ?? '')"><RozsvicenoWordmark /></NuxtLink>
      <nav class="items-center gap-8" :class="long ? 'hidden xl:flex' : 'hidden lg:flex'" :aria-label="words.mainMenu">
        <NuxtLink v-for="l in links" :key="l.id" class="navlink" :to="l.url" :target="l.newTab ? '_blank' : undefined">{{ l.label }}</NuxtLink>
      </nav>
      <div class="items-center gap-6" :class="long ? 'hidden xl:flex' : 'hidden lg:flex'">
        <a v-if="settings?.phone" class="navlink" :href="telHref(settings.phone)"><UIcon name="i-lucide-phone" class="size-4 mr-2 text-lamp" aria-hidden="true" />{{ settings.phone }}</a>
        <NuxtLink v-if="cta" class="btn btn-line min-h-[46px] px-6" :to="cta.url">{{ cta.label }}</NuxtLink>
      </div>
      <button type="button" class="shrink-0 inline-flex items-center gap-2 min-h-[44px] px-4 rounded-full bg-surface font-medium cursor-pointer" :class="long ? 'xl:hidden' : 'lg:hidden'" :aria-expanded="menu.open.value" aria-controls="site-menu" @click="menu.show()">
        <UIcon name="i-lucide-menu" class="size-5" aria-hidden="true" /> {{ words.menu }}
      </button>
    </div>

    <!-- Mobile menu -->
    <div v-show="menu.open.value" id="site-menu" class="fixed inset-0 z-50 bg-night overflow-y-auto" :class="long ? 'xl:hidden' : 'lg:hidden'">
      <div class="wrap pb-10">
        <div class="flex items-center justify-between h-[72px]">
          <span aria-hidden="true"><RozsvicenoWordmark plain /></span>
          <button type="button" class="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-full bg-surface font-medium cursor-pointer" @click="menu.hide()">
            <UIcon name="i-lucide-x" class="size-5" aria-hidden="true" /> {{ words.close }}
          </button>
        </div>
        <nav class="mt-4 flex flex-col gap-2" :aria-label="words.mobileMenu">
          <NuxtLink v-for="l in links" :key="l.id" class="serif font-semibold text-[1.9rem] px-5 py-3 rounded-[1.2rem] bg-surface" :to="l.url" @click="menu.hide()">{{ l.label }} <span v-if="isOffer(l.url)" class="font-sans text-[0.9rem] text-lamp ml-1">{{ total }}</span></NuxtLink>
        </nav>
        <NuxtLink v-if="cta" class="btn w-full mt-6" :to="cta.url" @click="menu.hide()">{{ cta.label }}</NuxtLink>
        <p v-if="settings?.hours" class="mt-6 text-quiet">{{ settings.hours }}</p>
        <a v-if="settings?.phone" class="inline-flex items-center gap-2 min-h-[44px] fig text-[1.5rem]" :href="telHref(settings.phone)"><UIcon name="i-lucide-phone" class="text-lamp" aria-hidden="true" />{{ settings.phone }}</a>
      </div>
    </div>
  </header>
</template>
