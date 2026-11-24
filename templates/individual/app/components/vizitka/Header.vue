<script setup lang="ts">
// Vizitka's header: the name with what the person does on the left, the menu, the phone and a
// ruled button on the right. Below a desktop's width the menu folds behind a button into a
// full-screen panel of the brand colour.
const { nav } = await useSite()
const { settings, name, words, cta } = await useProfile()
const links = computed(() => menuLinks(nav.value?.main))
const menu = useOverlayMenu()
</script>

<template>
  <header class="wrap">
    <div class="flex items-center justify-between h-[72px] lg:h-[88px]">
      <NuxtLink to="/" class="inline-flex items-baseline gap-3 min-h-[44px] items-center" :aria-label="words.toTop(name)">
        <VizitkaWordmark />
        <span v-if="settings?.role" class="label text-quiet hidden sm:inline">{{ settings.role }}</span>
      </NuxtLink>
      <nav class="hidden lg:flex items-center gap-9" :aria-label="words.mainMenu">
        <NuxtLink v-for="l in links" :key="l.id" class="navlink" :to="l.url" :target="l.newTab ? '_blank' : undefined">{{ czText(l.label) }}</NuxtLink>
        <a v-if="settings?.phone" class="navlink" :href="telHref(settings.phone)">{{ tidyText(settings.phone) }}</a>
        <NuxtLink v-if="cta" class="btn btn-line !min-h-[46px] !px-5" :to="cta.url">{{ cta.label }}</NuxtLink>
      </nav>
      <button type="button" class="lg:hidden inline-flex items-center gap-2 min-h-[44px] pl-4 label text-ink cursor-pointer" :aria-expanded="menu.open.value" aria-controls="site-menu" @click="menu.show()">
        {{ words.menu }} <UIcon name="i-lucide-menu" class="text-[1.25rem]" aria-hidden="true" />
      </button>
    </div>

    <!-- Mobile menu -->
    <div v-show="menu.open.value" id="site-menu" class="fixed inset-0 z-50 bg-brand text-brand-ink on-brand overflow-y-auto lg:hidden">
      <div class="wrap flex items-center justify-between h-[72px]">
        <span class="serif text-[1.45rem] font-semibold tracking-[-0.015em]" aria-hidden="true">{{ name }}</span>
        <button type="button" class="inline-flex items-center gap-2 min-h-[44px] pl-4 label cursor-pointer" @click="menu.hide()">
          {{ words.close }} <UIcon name="i-lucide-x" class="text-[1.25rem]" aria-hidden="true" />
        </button>
      </div>
      <nav class="wrap pt-6 pb-10 flex flex-col" :aria-label="words.mobileMenu">
        <NuxtLink v-for="l in links" :key="l.id" class="serif text-[2rem] py-3 border-b border-brand-ink/25" :to="l.url" :target="l.newTab ? '_blank' : undefined" @click="menu.hide()">{{ czText(l.label) }}</NuxtLink>
        <NuxtLink v-if="cta" class="serif text-[2rem] py-3 border-b border-brand-ink/25" :to="cta.url" @click="menu.hide()">{{ words.contact }}</NuxtLink>
        <NuxtLink v-if="cta" class="btn btn-paper mt-8" :to="cta.url" @click="menu.hide()">{{ words.firstCall }}</NuxtLink>
        <a v-if="settings?.phone" class="mt-5 inline-flex items-center min-h-[44px] gap-3" :href="telHref(settings.phone)"><UIcon name="i-lucide-phone" aria-hidden="true" /> {{ tidyText(settings.phone) }}</a>
      </nav>
    </div>
  </header>
</template>
