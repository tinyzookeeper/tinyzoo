<script setup lang="ts">
// Mistr: a line with the towns and the hours above, then the sticky header: the name on the
// left, the menu, the phone and the button on the right. Below a desktop's width the menu
// folds behind a button, and a phone gets a short "Zavolat" button beside it.
const { nav } = await useSite()
const { settings, phone, cta, words } = await useTrades()
const links = computed(() => menuLinks(nav.value?.main))
const menu = useOverlayMenu()
</script>

<template>
  <div v-if="settings?.areaLine || settings?.hoursLine" class="bg-tint text-[0.875rem] text-body">
    <div class="wrap flex items-center justify-between gap-6 min-h-[40px] py-1.5">
      <p v-if="settings.areaLine" class="hidden md:block">{{ settings.areaLine }}</p>
      <p v-if="settings.hoursLine"><span class="font-semibold text-ink">{{ words.answering }}</span> {{ settings.hoursLine }}</p>
    </div>
  </div>

  <header class="sticky top-0 z-40 bg-paper border-b border-line">
    <div class="wrap flex items-center justify-between gap-4 h-[68px] md:h-[80px]">
      <NuxtLink to="/" class="flex flex-col justify-center min-h-[44px] leading-none" :aria-label="words.toTop(settings?.siteName ?? '')"><MistrWordmark /></NuxtLink>
      <nav class="hidden lg:flex gap-7" :aria-label="words.mainMenu">
        <NuxtLink v-for="l in links" :key="l.id" class="navlink" :to="l.url" :target="l.newTab ? '_blank' : undefined">{{ l.label }}</NuxtLink>
      </nav>
      <div class="flex items-center gap-2 md:gap-5">
        <a v-if="phone" :href="phone.href" class="hidden md:inline-flex items-center gap-2 min-h-[44px] text-ink text-[1.125rem] font-bold tabular-nums hover:text-brand transition-colors">
          <UIcon name="i-lucide-phone" class="size-[18px]" aria-hidden="true" /> {{ phone.text }}
        </a>
        <NuxtLink v-if="cta" :to="cta.url" class="btn btn-brand hidden md:inline-flex !min-h-[46px] text-[0.9375rem]">{{ cta.label }}</NuxtLink>
        <a v-if="phone" :href="phone.href" class="md:hidden btn btn-brand !min-h-[44px] !px-3.5 text-[0.9375rem] tabular-nums" :aria-label="words.callNumber(phone.text)">
          <UIcon name="i-lucide-phone" class="size-[17px]" aria-hidden="true" /> {{ words.call }}
        </a>
        <button type="button" class="lg:hidden inline-flex items-center justify-center w-11 h-11 text-ink rounded-[4px] hover:bg-tint transition-colors cursor-pointer" :aria-expanded="menu.open.value" aria-controls="site-menu" :aria-label="words.openMenu" @click="menu.show()">
          <UIcon name="i-lucide-menu" class="size-6" aria-hidden="true" />
        </button>
      </div>
    </div>
  </header>

  <!-- Mobile menu -->
  <div v-show="menu.open.value" id="site-menu" class="fixed inset-0 z-50 bg-paper overflow-y-auto lg:hidden">
    <div class="wrap flex flex-col min-h-full pb-8">
      <div class="flex items-center justify-between h-[68px] border-b border-line">
        <span aria-hidden="true"><MistrWordmark /></span>
        <button type="button" class="inline-flex items-center justify-center w-11 h-11 text-ink rounded-[4px] hover:bg-tint cursor-pointer" :aria-label="words.closeMenu" @click="menu.hide()">
          <UIcon name="i-lucide-x" class="size-6" aria-hidden="true" />
        </button>
      </div>
      <nav class="flex flex-col py-4" :aria-label="words.mobileMenu">
        <NuxtLink v-for="l in links" :key="l.id" class="flex items-center justify-between min-h-[56px] border-b border-line text-ink text-[1.25rem] font-semibold" :to="l.url" @click="menu.hide()">
          {{ l.label }} <UIcon name="i-lucide-arrow-right" class="size-[18px] text-quiet" aria-hidden="true" />
        </NuxtLink>
      </nav>
      <div class="mt-auto pt-6 grid gap-3">
        <a v-if="phone" :href="phone.href" class="btn btn-brand !min-h-[60px] text-[1.35rem] tabular-nums"><UIcon name="i-lucide-phone" class="size-5" aria-hidden="true" /> {{ phone.text }}</a>
        <NuxtLink v-if="cta" :to="cta.url" class="btn btn-line" @click="menu.hide()">{{ cta.label }}</NuxtLink>
        <p v-if="settings?.hoursLine" class="text-[0.9375rem] text-quiet text-center mt-1">{{ words.answering }} {{ settings.hoursLine }}</p>
      </div>
    </div>
  </div>
</template>
