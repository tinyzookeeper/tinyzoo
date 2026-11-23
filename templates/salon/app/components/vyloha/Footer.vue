<script setup lang="ts">
// Výloha's footer: the darkest shade, the name between two brass lines, three centred columns
// and a closing line; on a phone the bar with the phone, the price list and booking slides up
// once the opening is behind.
const { nav } = await useSite()
const { settings, words, phone } = await useSalon()
const legal = computed(() => menuLinks(nav.value?.legal))
const scrolled = useScrolled()
// "Kadeřnictví a holičství · Jičín · od roku 2014"
const sign = computed(() => [settings.value?.tagline, settings.value?.founded ? words.value.vyloha.since(settings.value.founded) : ''].filter(Boolean).join(' · '))
</script>

<template>
  <footer class="bg-shade">
    <div class="wrap pt-14 md:pt-20 pb-28 md:pb-12">
      <div class="text-center">
        <p class="flanked"><span class="min-w-0 text-center"><VylohaWordmark large /></span></p>
        <p v-if="sign" class="mt-5 caps text-brass !text-[12px]">{{ sign }}</p>
      </div>
      <div class="mt-12 grid sm:grid-cols-3 gap-10 text-center">
        <div>
          <p class="caps !text-[12px] text-brass">{{ words.contact }}</p>
          <ul class="mt-3">
            <li v-if="phone"><a class="inline-flex items-center min-h-11 font-display text-[22px] text-cream hover:text-brass" :href="phone.href">{{ phone.text }}</a></li>
            <li v-if="settings?.email"><a class="inline-flex items-center min-h-11 text-cream hover:text-brass break-all" :href="`mailto:${settings.email}`">{{ settings.email }}</a></li>
          </ul>
        </div>
        <div v-if="settings?.address">
          <p class="caps !text-[12px] text-brass">{{ words.vyloha.address }}</p>
          <p class="mt-5 text-cream">{{ settings.address }}<template v-if="settings.town"><br>{{ settings.town }}</template></p>
          <p v-if="settings.hoursShort" class="mt-2 text-[15px]">{{ settings.hoursShort }}</p>
        </div>
        <div v-if="settings?.instagram || settings?.facebook">
          <p class="caps !text-[12px] text-brass">{{ words.followUs }}</p>
          <ul class="mt-3">
            <li v-if="settings.instagram"><a class="inline-flex items-center gap-2 min-h-11 text-cream hover:text-brass" :href="settings.instagram" target="_blank" rel="noopener"><UIcon name="i-lucide-instagram" aria-hidden="true" />Instagram</a></li>
            <li v-if="settings.facebook"><a class="inline-flex items-center gap-2 min-h-11 text-cream hover:text-brass" :href="settings.facebook" target="_blank" rel="noopener"><UIcon name="i-lucide-facebook" aria-hidden="true" />Facebook</a></li>
          </ul>
        </div>
      </div>
      <p v-if="settings?.legal || legal.length" class="mt-12 pt-6 border-t border-brass/30 text-[14px] text-center">
        <template v-if="settings?.legal">{{ tidyText(settings.legal) }}</template>
        <template v-for="l in legal" :key="l.id">{{ ' · ' }}<NuxtLink :to="l.url" class="underline underline-offset-4 hover:text-brass">{{ l.label }}</NuxtLink></template>
      </p>
    </div>
  </footer>

  <!-- Phone: price list and booking always at hand -->
  <div class="md:hidden fixed inset-x-0 bottom-0 z-40 transition-transform duration-300 bg-shade border-t border-brass/60 px-3 py-2.5 grid grid-cols-[48px_1fr_1fr] gap-2.5" :class="scrolled ? '' : 'translate-y-full'" :aria-hidden="!scrolled">
    <a v-if="phone" :href="phone.href" class="h-12 inline-flex items-center justify-center text-brass text-xl border border-brass/70" :aria-label="words.callPhone(phone.text)" :tabindex="scrolled ? undefined : -1"><UIcon name="i-lucide-phone" aria-hidden="true" /></a>
    <NuxtLink :to="`/#${anchorOf('pricelist')}`" class="panel btn btn-line !min-h-12 !px-2 !text-[13px]" style="--r:8px" :tabindex="scrolled ? undefined : -1">{{ words.priceList }}</NuxtLink>
    <NuxtLink :to="`/#${anchorOf('booking')}`" class="plate btn btn-cream !min-h-12 !px-2 !text-[13px]" style="--pr:8px" :tabindex="scrolled ? undefined : -1">{{ words.order }}</NuxtLink>
  </div>
</template>
