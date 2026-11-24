<script setup lang="ts">
// Katastr: a thin line with the office and its phone, then the name, the menu and a ruled
// button. Below a desktop's width the menu folds behind a button.
const { nav } = await useSite()
const { settings, addressShort, cta, words } = await useOffice()
const { total } = await useOffer()
const w = words.value.katastr
const links = computed(() => menuLinks(nav.value?.main))
const menu = useOverlayMenu()
// With a long name the menu folds behind its button until the row is wide enough for both.
const long = computed(() => (settings.value?.siteName ?? '').length > 24)
const top = computed(() => [w.agency, addressShort.value, settings.value?.hours].filter(Boolean).join(' · '))
/** The link to the listings carries how many there are, in the phone's menu. */
const isOffer = (url: string) => url.endsWith(`#${words.value.anchors.listings}`)
</script>

<template>
  <header>
    <div class="hidden md:block border-b border-line text-[0.85rem] text-quiet">
      <div class="wrap flex items-center justify-between h-10">
        <p>{{ top }}</p>
        <p class="flex gap-6">
          <a v-if="settings?.phone" class="hover:text-brand transition-colors num" :href="telHref(settings.phone)">{{ settings.phone }}</a>
          <a v-if="settings?.email" class="hover:text-brand transition-colors" :href="`mailto:${settings.email}`">{{ settings.email }}</a>
        </p>
      </div>
    </div>

    <div class="wrap">
      <div class="flex items-center justify-between h-[72px] md:h-[84px] border-b border-line">
        <NuxtLink to="/" class="flex min-w-0 items-center gap-2 min-h-[44px]" :aria-label="w.toTop(settings?.siteName ?? '')"><KatastrWordmark /></NuxtLink>
        <nav class="items-center gap-8" :class="long ? 'hidden xl:flex' : 'hidden lg:flex'" :aria-label="words.mainMenu">
          <NuxtLink v-for="l in links" :key="l.id" class="navlink" :to="l.url" :target="l.newTab ? '_blank' : undefined">{{ l.label }}</NuxtLink>
        </nav>
        <div v-if="cta" :class="long ? 'hidden xl:block' : 'hidden lg:block'">
          <NuxtLink class="btn btn-line" :to="cta.url">{{ cta.label }}</NuxtLink>
        </div>
        <button type="button" class="shrink-0 inline-flex items-center gap-2 min-h-[44px] pl-4 text-ink font-medium cursor-pointer" :class="long ? 'xl:hidden' : 'lg:hidden'" :aria-expanded="menu.open.value" aria-controls="site-menu" @click="menu.show()">
          <UIcon name="i-lucide-menu" class="size-5" aria-hidden="true" /> {{ words.menu }}
        </button>
      </div>
    </div>

    <!-- Mobile menu -->
    <div v-show="menu.open.value" id="site-menu" class="fixed inset-0 z-50 bg-paper overflow-y-auto" :class="long ? 'xl:hidden' : 'lg:hidden'">
      <div class="wrap">
        <div class="flex items-center justify-between h-[72px] border-b border-line">
          <span aria-hidden="true"><KatastrWordmark plain /></span>
          <button type="button" class="inline-flex items-center gap-2 min-h-[44px] pl-4 text-ink font-medium cursor-pointer" @click="menu.hide()">
            <UIcon name="i-lucide-x" class="size-5" aria-hidden="true" /> {{ words.close }}
          </button>
        </div>
        <nav class="py-6 flex flex-col" :aria-label="words.mobileMenu">
          <NuxtLink v-for="l in links" :key="l.id" class="serif text-ink text-[1.9rem] py-3 border-b border-line" :to="l.url" @click="menu.hide()">{{ l.label }}<span v-if="isOffer(l.url)" class="label text-quiet ml-2">{{ total }}</span></NuxtLink>
        </nav>
        <NuxtLink v-if="cta" class="btn w-full" :to="cta.url" @click="menu.hide()">{{ cta.label }}</NuxtLink>
        <p v-if="settings?.hours" class="mt-6 text-quiet">{{ settings.hours }}</p>
        <a v-if="settings?.phone" class="rowlink num" :href="telHref(settings.phone)"><UIcon name="i-lucide-phone" class="ic" aria-hidden="true" />{{ settings.phone }}</a>
        <a v-if="settings?.email" class="rowlink" :href="`mailto:${settings.email}`"><UIcon name="i-lucide-mail" class="ic" aria-hidden="true" />{{ settings.email }}</a>
      </div>
    </div>
  </header>
</template>
