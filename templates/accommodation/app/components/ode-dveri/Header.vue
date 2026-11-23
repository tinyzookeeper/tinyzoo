<script setup lang="ts">
// Ode dveří's header: the name, the menu, the phone and the button on the white page. Below a
// desktop's width the menu folds behind a button; its panel says in a few words what each link
// leads to (how many rooms, the price from, how far the trips go).
const { nav } = await useSite()
const { settings, name, words, tel, cta } = await useStay()
const links = computed(() => menuLinks(nav.value?.main))
const menu = useOverlayMenu()
const [pricing, trips] = await Promise.all([usePricing(), useTrips()])
// A few words after a link of the phone menu, worked out from what the link leads to.
function hintOf(url: string): string {
  const id = url.split('#')[1]
  if (id === anchorOf('rooms') && pricing.rooms.value.length) return words.value.menuHints.rooms(pricing.rooms.value.length, pricing.rooms.value.reduce((n, r) => n + r.beds, 0))
  if (id === anchorOf('prices') && pricing.cheapest.value != null) return words.value.menuHints.prices(`${formatPrice(pricing.cheapest.value)} Kč`)
  if (id === anchorOf('trips') && trips.value.length) {
    const far = Math.max(...trips.value.map((t) => kilometres(t.distance) ?? 0))
    return far > 0 ? words.value.menuHints.trips(trips.value.length, `${String(far).replace('.', ',')} km`) : ''
  }
  if (id === anchorOf('house')) return words.value.menuHints.house
  return ''
}
</script>

<template>
  <header>
    <div class="wrap flex items-center justify-between gap-6 py-4 md:py-5">
      <NuxtLink to="/" class="flex items-center gap-2.5 min-h-11" :aria-label="words.toTop(name)">
        <OdeDveriWordmark />
        <span v-if="settings?.tagline" class="hidden xl:inline text-sm text-quiet pl-1.5">{{ settings.tagline }}</span>
      </NuxtLink>
      <nav class="hidden lg:flex items-center gap-8" :aria-label="words.mainMenu">
        <NuxtLink v-for="l in links" :key="l.id" class="navlink" :to="l.url" :target="l.newTab ? '_blank' : undefined">{{ l.label }}</NuxtLink>
      </nav>
      <div class="flex items-center gap-5">
        <a v-if="settings?.phone" :href="tel" class="navlink hidden md:inline-flex gap-2 num"><UIcon name="i-lucide-phone" class="size-[1em] text-brand" aria-hidden="true" />{{ settings.phone }}</a>
        <NuxtLink v-if="cta" :to="cta.url" class="btn hidden sm:inline-flex !min-h-11 !px-5">{{ cta.label }}</NuxtLink>
        <button type="button" class="lg:hidden btn btn-soft !min-h-11 !px-4" :aria-expanded="menu.open.value" aria-controls="site-menu" @click="menu.show()">
          <UIcon name="i-lucide-menu" class="size-5" aria-hidden="true" />{{ words.menu }}
        </button>
      </div>
    </div>

    <!-- Mobile menu -->
    <div v-show="menu.open.value" id="site-menu" class="fixed inset-0 z-50 bg-paper overflow-y-auto lg:hidden" role="dialog" aria-modal="true" :aria-label="words.menu">
      <div class="wrap py-4 flex items-center justify-between">
        <span class="flex items-center gap-2.5" aria-hidden="true"><OdeDveriWordmark /></span>
        <button type="button" class="btn btn-soft !min-h-11 !px-4" @click="menu.hide()"><UIcon name="i-lucide-x" class="size-5" aria-hidden="true" />{{ words.close }}</button>
      </div>
      <nav class="wrap pt-4 pb-10 flex flex-col" :aria-label="words.mobileMenu">
        <NuxtLink v-for="l in links" :key="l.id" class="rule flex items-baseline justify-between gap-4 py-4 text-2xl font-semibold tracking-[-0.02em] text-ink" :to="l.url" @click="menu.hide()">
          {{ l.label }} <span v-if="hintOf(l.url)" class="text-base font-normal tracking-normal text-quiet num">{{ hintOf(l.url) }}</span>
        </NuxtLink>
        <NuxtLink v-if="cta" :to="cta.url" class="btn mt-7" @click="menu.hide()">{{ cta.label }}</NuxtLink>
        <a v-if="settings?.phone" :href="tel" class="btn btn-soft mt-3 num"><UIcon name="i-lucide-phone" class="size-[1em]" aria-hidden="true" />{{ settings.phone }}</a>
        <p v-if="settings?.address" class="mt-7 text-quiet">{{ settings.address }}<template v-if="settings.arrival || settings.departure"><br>{{ [settings.arrival && `${words.arrival} ${settings.arrival}`, settings.departure && `${words.departure.toLowerCase()} ${settings.departure}`].filter(Boolean).join(', ') }}</template></p>
      </nav>
    </div>
  </header>
</template>
