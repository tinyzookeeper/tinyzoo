<script setup lang="ts">
// Šachovnice's footer: black, under a strip of the floor, with the name set huge in the brand
// colour; on a phone the bar with the phone, the price list and booking slides up once the
// opening is behind.
const { nav } = await useSite()
const { settings, words, phone } = await useSalon()
const legal = computed(() => menuLinks(nav.value?.legal))
const scrolled = useScrolled()
const address = computed(() => [settings.value?.address, settings.value?.town].filter(Boolean).join(', '))
</script>

<template>
  <footer class="on-ink bg-ink text-paper">
    <div class="checker h-12 border-t-2 border-ink" style="--sq:24px" aria-hidden="true" />
    <div class="wrap pt-14 md:pt-20 pb-28 md:pb-12">
      <p class="text-brand"><SachovniceWordmark large /></p>
      <div class="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-x-10 gap-y-10">
        <div v-if="settings?.about">
          <p class="tag text-brand">{{ words.sachovnice.about }}</p>
          <p class="mt-4">{{ tidyText(settings.about) }}</p>
        </div>
        <div>
          <p class="tag text-brand">{{ words.contact }}</p>
          <ul class="mt-2">
            <li v-if="phone"><a class="inline-flex items-center min-h-11 font-extrabold hover:text-brand" :href="phone.href">{{ phone.text }}</a></li>
            <li v-if="settings?.email"><a class="inline-flex items-center min-h-11 font-extrabold hover:text-brand break-all" :href="`mailto:${settings.email}`">{{ settings.email }}</a></li>
            <li v-if="address" class="pt-1">{{ address }}</li>
          </ul>
        </div>
        <div v-if="settings?.instagram || settings?.facebook">
          <p class="tag text-brand">{{ words.sachovnice.networks }}</p>
          <ul class="mt-2">
            <li v-if="settings.instagram"><a class="inline-flex items-center gap-2 min-h-11 font-extrabold hover:text-brand" :href="settings.instagram" target="_blank" rel="noopener"><UIcon name="i-lucide-instagram" aria-hidden="true" />Instagram</a></li>
            <li v-if="settings.facebook"><a class="inline-flex items-center gap-2 min-h-11 font-extrabold hover:text-brand" :href="settings.facebook" target="_blank" rel="noopener"><UIcon name="i-lucide-facebook" aria-hidden="true" />Facebook</a></li>
          </ul>
        </div>
        <div>
          <p class="tag text-brand">{{ words.sachovnice.web }}</p>
          <ul class="mt-2">
            <li><NuxtLink class="inline-flex items-center min-h-11 font-extrabold hover:text-brand" :to="`/#${anchorOf('pricelist')}`">{{ words.priceList }}</NuxtLink></li>
            <li><NuxtLink class="inline-flex items-center min-h-11 font-extrabold hover:text-brand" :to="`/#${anchorOf('booking')}`">{{ words.booking }}</NuxtLink></li>
            <li v-for="l in legal" :key="l.id"><NuxtLink class="inline-flex items-center min-h-11 font-extrabold hover:text-brand" :to="l.url">{{ l.label }}</NuxtLink></li>
          </ul>
        </div>
      </div>
      <p v-if="settings?.legal" class="mt-12 pt-6 border-t-2 border-paper/25 text-[15px] opacity-80">{{ tidyText(settings.legal) }}</p>
    </div>
  </footer>

  <!-- Phone: price list and booking always at hand -->
  <div class="md:hidden fixed inset-x-0 bottom-0 z-40 transition-transform duration-300 grid grid-cols-[56px_1fr_1fr] border-t-2 border-ink font-display font-bold text-[14px]" :class="scrolled ? '' : 'translate-y-full'" :aria-hidden="!scrolled">
    <a v-if="phone" :href="phone.href" class="h-14 bg-paper text-ink inline-flex items-center justify-center text-xl border-r-2 border-ink" :aria-label="words.callPhone(phone.text)" :tabindex="scrolled ? undefined : -1"><UIcon name="i-lucide-phone" aria-hidden="true" /></a>
    <NuxtLink :to="`/#${anchorOf('pricelist')}`" class="h-14 bg-paper text-ink inline-flex items-center justify-center border-r-2 border-ink" :tabindex="scrolled ? undefined : -1">{{ words.priceList }}</NuxtLink>
    <NuxtLink :to="`/#${anchorOf('booking')}`" class="h-14 bg-ink text-paper inline-flex items-center justify-center" :tabindex="scrolled ? undefined : -1">{{ words.order }}</NuxtLink>
  </div>
</template>
