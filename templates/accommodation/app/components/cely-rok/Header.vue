<script setup lang="ts">
// Celý rok's header: the name, the menu, the phone and the button, over whatever opens the page
// (the opening's photograph reaches up behind it: the opening pulls itself up by the header's
// height). Below a desktop's width the menu folds behind a button.
const { nav } = await useSite()
const { settings, name, words, tel, cta } = await useStay()
const links = computed(() => menuLinks(nav.value?.main))
const menu = useOverlayMenu()
</script>

<template>
  <header class="relative z-30">
    <div class="wrap flex items-center justify-between gap-6 py-5">
      <NuxtLink to="/" class="flex items-baseline gap-3 min-h-11" :aria-label="words.toTop(name)">
        <CelyRokWordmark />
        <span v-if="settings?.tagline" class="label hidden sm:inline !text-text/85">{{ settings.tagline }}</span>
      </NuxtLink>
      <nav class="hidden lg:flex items-center gap-8 text-[0.98rem]" :aria-label="words.mainMenu">
        <NuxtLink v-for="l in links" :key="l.id" class="navlink" :to="l.url" :target="l.newTab ? '_blank' : undefined">{{ l.label }}</NuxtLink>
      </nav>
      <div class="flex items-center gap-5">
        <a v-if="settings?.phone" :href="tel" class="navlink hidden md:inline-flex gap-2 num"><UIcon name="i-lucide-phone" class="size-[1em] text-brand" aria-hidden="true" />{{ settings.phone }}</a>
        <NuxtLink v-if="cta" :to="cta.url" class="btn hidden sm:inline-flex !min-h-11 !px-5">{{ cta.label }}</NuxtLink>
        <button type="button" class="lg:hidden inline-flex items-center justify-center gap-2 min-h-11 min-w-11 px-3 font-semibold bg-bg/60 cursor-pointer" :aria-expanded="menu.open.value" aria-controls="site-menu" @click="menu.show()">
          <UIcon name="i-lucide-menu" class="size-5" aria-hidden="true" /><span>{{ words.menu }}</span>
        </button>
      </div>
    </div>

    <!-- Mobile menu -->
    <div v-show="menu.open.value" id="site-menu" class="fixed inset-0 z-50 bg-bg overflow-y-auto lg:hidden" role="dialog" aria-modal="true" :aria-label="words.menu">
      <div class="wrap py-5 flex items-center justify-between">
        <span aria-hidden="true"><CelyRokWordmark /></span>
        <button type="button" class="inline-flex items-center justify-center gap-2 min-h-11 px-3 font-semibold cursor-pointer" @click="menu.hide()"><UIcon name="i-lucide-x" class="size-5" aria-hidden="true" />{{ words.close }}</button>
      </div>
      <nav class="wrap pt-6 pb-10 flex flex-col" :aria-label="words.mobileMenu">
        <NuxtLink v-for="l in links" :key="l.id" class="font-display text-4xl py-3 rule" :to="l.url" @click="menu.hide()">{{ l.label }}</NuxtLink>
        <NuxtLink v-if="cta" :to="cta.url" class="btn mt-8" @click="menu.hide()">{{ cta.label }}</NuxtLink>
        <a v-if="settings?.phone" :href="tel" class="btn btn-line mt-3 num"><UIcon name="i-lucide-phone" class="size-[1em]" aria-hidden="true" />{{ settings.phone }}</a>
        <p v-if="settings?.address" class="mt-8 text-quiet">{{ settings.address }}<template v-if="settings.arrival || settings.departure"><br>{{ [settings.arrival && `${words.arrival} ${settings.arrival}`, settings.departure && `${words.departure.toLowerCase()} ${settings.departure}`].filter(Boolean).join(', ') }}</template></p>
      </nav>
    </div>
  </header>
</template>
