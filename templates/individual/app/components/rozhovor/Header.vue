<script setup lang="ts">
// Rozhovor's header: the bubble mark and the name on the left, the menu as soft pills and a
// ruled round button on the right. Below a desktop's width the menu folds behind a pill button
// into a card on a dimmed page.
const { nav } = await useSite()
const { settings, name, words, cta } = await useProfile()
const links = computed(() => menuLinks(nav.value?.main))
const menu = useOverlayMenu()
</script>

<template>
  <header class="wrap">
    <div class="flex items-center justify-between h-[76px] lg:h-[96px]">
      <NuxtLink to="/" class="inline-flex items-center gap-3 min-h-[44px]" :aria-label="words.toTop(name)"><RozhovorWordmark /></NuxtLink>
      <nav class="hidden lg:flex items-center gap-1" :aria-label="words.mainMenu">
        <NuxtLink v-for="l in links" :key="l.id" class="navlink" :to="l.url" :target="l.newTab ? '_blank' : undefined">{{ czText(l.label) }}</NuxtLink>
        <NuxtLink v-if="cta" class="btn btn-line !min-h-[46px] !px-6 !text-[1.05rem] ml-3" :to="cta.url">{{ cta.label }}</NuxtLink>
      </nav>
      <button type="button" class="lg:hidden inline-flex items-center gap-2 min-h-[44px] px-4 rounded-full bg-card text-ink font-bold cursor-pointer" :aria-expanded="menu.open.value" aria-controls="site-menu" @click="menu.show()">
        <UIcon name="i-lucide-menu" class="text-[1.2rem]" aria-hidden="true" /> {{ words.menu }}
      </button>
    </div>

    <!-- Mobile menu -->
    <div v-show="menu.open.value" id="site-menu" class="fixed inset-0 z-50 bg-ink/40 p-2 overflow-y-auto lg:hidden" @click.self="menu.hide()">
      <div class="bg-card rounded-[1.75rem] p-5 pb-7">
        <div class="flex items-center justify-between">
          <span class="serif text-ink text-[1.35rem] font-bold tracking-[-0.03em]" aria-hidden="true">{{ name }}</span>
          <button type="button" class="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-full bg-paper text-ink font-bold cursor-pointer" @click="menu.hide()">
            <UIcon name="i-lucide-x" class="text-[1.2rem]" aria-hidden="true" /> {{ words.close }}
          </button>
        </div>
        <nav class="mt-5 flex flex-col" :aria-label="words.mobileMenu">
          <NuxtLink v-for="l in links" :key="l.id" class="serif italic text-ink text-[1.7rem] tracking-[-0.02em] py-3 border-b border-tint" :to="l.url" :target="l.newTab ? '_blank' : undefined" @click="menu.hide()">{{ czText(l.label) }}</NuxtLink>
          <NuxtLink v-if="cta" class="btn mt-6" :to="cta.url" @click="menu.hide()">{{ words.firstCall }}</NuxtLink>
          <a v-if="settings?.phone" class="mt-4 inline-flex items-center justify-center gap-3 min-h-[44px] text-ink font-bold" :href="telHref(settings.phone)"><UIcon name="i-lucide-phone" aria-hidden="true" /> {{ tidyText(settings.phone) }}</a>
        </nav>
      </div>
    </div>
  </header>
</template>
