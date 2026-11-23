<script setup lang="ts">
// Reflex: the header sits on the field of signal colour that the opening continues. The name
// on the left, the menu and a black button on the right; below a desktop's width the menu
// folds behind a button and opens as a full-screen field with the phone number last.
const { nav } = await useSite()
const { settings, phone, cta, words } = await useTrades()
const links = computed(() => menuLinks(nav.value?.main))
const menu = useOverlayMenu()
</script>

<template>
  <div class="on-brand bg-brand text-brand-ink">
    <header class="wrap flex items-center justify-between gap-4 h-[72px] md:h-[84px]">
      <NuxtLink to="/" class="flex items-center min-h-[44px]" :aria-label="words.toTop(settings?.siteName ?? '')"><ReflexWordmark /></NuxtLink>
      <nav class="hidden lg:flex gap-8" :aria-label="words.mainMenu">
        <NuxtLink v-for="l in links" :key="l.id" class="navlink" :to="l.url" :target="l.newTab ? '_blank' : undefined">{{ l.label }}</NuxtLink>
      </nav>
      <div class="flex items-center gap-2">
        <NuxtLink v-if="cta" :to="cta.url" class="btn btn-ink hidden md:inline-flex !min-h-[48px] !text-[1rem]" style="--paper:#fff">{{ cta.label }}</NuxtLink>
        <button type="button" class="lg:hidden inline-flex items-center gap-2 min-h-[44px] pl-3 label cursor-pointer" :aria-expanded="menu.open.value" aria-controls="site-menu" @click="menu.show()">
          {{ words.menu }} <UIcon name="i-lucide-menu" class="size-[26px]" aria-hidden="true" />
        </button>
      </div>
    </header>
  </div>

  <!-- Mobile menu -->
  <div v-show="menu.open.value" id="site-menu" class="on-brand fixed inset-0 z-50 bg-brand text-brand-ink overflow-y-auto lg:hidden">
    <div class="wrap flex flex-col min-h-full pb-6">
      <div class="flex items-center justify-between h-[72px]">
        <span aria-hidden="true" class="text-[1.75rem] font-black tracking-[-0.045em] leading-none">{{ settings?.siteName }}</span>
        <button type="button" class="inline-flex items-center gap-2 min-h-[44px] pl-3 label cursor-pointer" :aria-label="words.closeMenu" @click="menu.hide()">{{ words.close }} <UIcon name="i-lucide-x" class="size-[26px]" aria-hidden="true" /></button>
      </div>
      <nav class="flex flex-col border-t-2 border-current" :aria-label="words.mobileMenu">
        <NuxtLink v-for="l in links" :key="l.id" class="flex items-center min-h-[64px] border-b-2 border-current text-[2.25rem] font-black tracking-[-0.04em]" :to="l.url" @click="menu.hide()">{{ l.label }}</NuxtLink>
      </nav>
      <div class="mt-auto pt-8 grid gap-3">
        <a v-if="phone" :href="phone.href" class="btn btn-ink !min-h-[68px] font-cond !text-[2.25rem] !font-black tabular-nums" style="--paper:#fff"><UIcon name="i-lucide-phone-call" class="size-6" aria-hidden="true" /> {{ phone.text }}</a>
        <NuxtLink v-if="cta" :to="cta.url" class="btn btn-line" @click="menu.hide()">{{ cta.label }}</NuxtLink>
        <p v-if="settings?.hoursLine" class="label text-center mt-1 !text-[0.9375rem]">{{ words.answeringShort }} {{ settings.hoursLine }}</p>
      </div>
    </div>
  </div>
</template>
