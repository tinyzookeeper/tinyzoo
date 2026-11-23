<script setup lang="ts">
// Negativ: the name on the left, the menu and the button on the right. On a page that opens
// with a photograph (the "Opening" block) the header lies over it, in the photograph's light
// text; on any other page it is a plain bar.
const { settings, nav } = await useSite()
const { page } = await useSitePage()
const words = useSiteWords()
const links = computed(() => menuLinks(nav.value?.main))
const cta = computed(() => (settings.value?.ctaLabel && settings.value.ctaUrl ? { label: settings.value.ctaLabel, url: siteHref(settings.value.ctaUrl) } : null))
const overPhoto = computed(() => page.value?.sections[0]?.type === 'hero' && !!page.value.sections[0].images[0]?.image)
const menu = useOverlayMenu()
</script>

<template>
  <header :class="overPhoto ? 'absolute inset-x-0 top-0 z-10 text-[var(--on-photo)]' : 'border-b border-rule'">
    <div class="pad flex items-center justify-between h-[72px] md:h-[84px]">
      <NuxtLink to="/" class="d text-[1.6rem] md:text-[1.75rem] min-h-[44px] inline-flex items-center"><NegativWordmark /></NuxtLink>
      <nav class="hidden lg:flex items-center gap-8 m" :aria-label="words.mainMenu">
        <NuxtLink v-for="l in links" :key="l.id" class="lnk" :to="l.url" :target="l.newTab ? '_blank' : undefined">{{ l.label }}</NuxtLink>
        <NuxtLink v-if="cta" class="btn m !font-medium" :class="overPhoto ? 'btn-hero' : ''" :to="cta.url">{{ cta.label }}</NuxtLink>
      </nav>
      <button type="button" class="lg:hidden m inline-flex items-center gap-2 min-h-[44px] pl-4" :aria-expanded="menu.open.value" aria-controls="site-menu" @click="menu.show()">
        {{ words.menu }} <UIcon name="i-lucide-menu" class="size-5" aria-hidden="true" />
      </button>
    </div>

    <!-- Mobile menu -->
    <div v-show="menu.open.value" id="site-menu" class="fixed inset-0 z-50 bg-bg text-fg overflow-y-auto lg:hidden">
      <div class="pad flex flex-col min-h-full pb-7">
        <div class="flex items-center justify-between h-[72px]">
          <span class="d text-[1.6rem]"><NegativWordmark /></span>
          <button type="button" class="m inline-flex items-center gap-2 min-h-[44px] pl-4" @click="menu.hide()">
            {{ words.close }} <UIcon name="i-lucide-x" class="size-5" aria-hidden="true" />
          </button>
        </div>
        <nav class="flex flex-col pt-4 d text-[18vw] md:text-[11vw]" :aria-label="words.mobileMenu">
          <NuxtLink v-for="l in links" :key="l.id" class="py-1 hover:text-brand" :to="l.url" @click="menu.hide()">{{ l.label }}</NuxtLink>
          <NuxtLink v-if="cta" class="py-1 text-brand" :to="cta.url" @click="menu.hide()">{{ words.contact }}</NuxtLink>
        </nav>
        <div class="mt-auto pt-8 m text-dim grid gap-1">
          <a v-if="settings?.phone" class="lnk text-fg" :href="telHref(settings.phone)">{{ settings.phone }}</a>
          <a v-if="settings?.email" class="lnk text-fg" :href="`mailto:${settings.email}`">{{ settings.email }}</a>
        </div>
      </div>
    </div>
  </header>
</template>
