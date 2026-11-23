<script setup lang="ts">
// Salon: a thin line with the three things a guest looks for (open now, where, the phone), then
// the name in the middle with the menu split on either side of it and the reservation button.
// Below a desktop's width the menu folds behind a button.
const { nav } = await useSite()
const { settings, address, phone, tel, words, state, openText } = await useRestaurant()
const links = computed(() => menuLinks(nav.value?.main))
// (the first half of the links on the left of the name, the rest on the right)
const half = computed(() => Math.ceil(links.value.length / 2))
const menu = useOverlayMenu()
const open = computed(() => openText(words.value.salon.open))
const reserve = `/#${anchorOf('reservation')}`
</script>

<template>
  <header>
    <!-- the top line -->
    <div class="border-b border-line">
      <div class="wrap flex items-center justify-between gap-6 py-2.5 text-[.95rem]">
        <p v-if="open" data-open :data-state="state?.open ? 'open' : 'closed'" class="text-cream"><span class="dot" /><span data-open-text>{{ open }}</span></p>
        <span v-else />
        <p v-if="address || phone" class="hidden md:block text-quiet">
          {{ address }}<template v-if="address && phone"> <span class="mx-2 text-brand">·</span> </template><a v-if="phone" class="link text-cream" :href="tel">{{ phone }}</a>
        </p>
        <a v-if="phone" class="md:hidden link" :href="tel">{{ phone }}</a>
      </div>
    </div>

    <div class="wrap">
      <div class="grid grid-cols-[1fr_auto] lg:grid-cols-[1fr_auto_1fr] items-center gap-6 py-5 lg:py-7">
        <nav class="hidden lg:flex items-center gap-9" :aria-label="words.mainMenu">
          <NuxtLink v-for="l in links.slice(0, half)" :key="l.id" class="navlink" :to="l.url" :target="l.newTab ? '_blank' : undefined">{{ l.label }}</NuxtLink>
        </nav>
        <NuxtLink to="/" class="block lg:text-center leading-none" :aria-label="`${settings?.siteName ?? ''}, ${settings?.tagline ?? ''}`"><SalonWordmark mark tagline /></NuxtLink>
        <nav class="hidden lg:flex items-center justify-end gap-9" :aria-label="words.mainMenu">
          <NuxtLink v-for="l in links.slice(half)" :key="l.id" class="navlink" :to="l.url" :target="l.newTab ? '_blank' : undefined">{{ l.label }}</NuxtLink>
          <NuxtLink class="btn btn-brand" :to="reserve">{{ words.reserve }}</NuxtLink>
        </nav>
        <button type="button" class="lg:hidden btn btn-line !px-4 cursor-pointer" :aria-expanded="menu.open.value" aria-controls="site-menu" @click="menu.show()">
          <UIcon name="i-lucide-menu" class="text-lg" aria-hidden="true" /> {{ words.menu }}
        </button>
      </div>
    </div>

    <!-- Mobile menu -->
    <div v-show="menu.open.value" id="site-menu" class="fixed inset-0 z-50 bg-night overflow-y-auto lg:hidden" role="dialog" aria-modal="true" :aria-label="words.menu">
      <div class="wrap flex items-center justify-between py-5">
        <span aria-hidden="true"><SalonWordmark size="panel" /></span>
        <button type="button" class="btn btn-line !px-4 cursor-pointer" @click="menu.hide()"><UIcon name="i-lucide-x" class="text-lg" aria-hidden="true" /> {{ words.close }}</button>
      </div>
      <nav class="wrap mt-4 flex flex-col font-display text-[1.9rem] leading-tight" :aria-label="words.mobileMenu">
        <NuxtLink v-for="(l, i) in links" :key="l.id" class="py-3.5 border-t border-line" :class="i === links.length - 1 ? 'border-b' : ''" :to="l.url" @click="menu.hide()">{{ l.label }}</NuxtLink>
      </nav>
      <div class="wrap mt-8 pb-10">
        <p v-if="open" data-open :data-state="state?.open ? 'open' : 'closed'"><span class="dot" /><span data-open-text>{{ open }}</span></p>
        <p v-if="address" class="mt-1 text-quiet">{{ address }}</p>
        <div class="mt-6 grid gap-3">
          <NuxtLink class="btn btn-brand" :to="reserve" @click="menu.hide()">{{ words.reserve }}</NuxtLink>
          <a v-if="phone" class="btn btn-line" :href="tel">{{ words.call(phone) }}</a>
        </div>
      </div>
    </div>
  </header>
</template>
