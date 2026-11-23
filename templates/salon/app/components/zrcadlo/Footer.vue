<script setup lang="ts">
// Zrcadlo's footer: a dark panel with rounded top corners, the name large, the contact, the
// networks and a few links; on a phone the bar with the phone, the price list and booking
// slides up once the opening is behind.
const { nav } = await useSite()
const { settings, words, phone } = await useSalon()
const legal = computed(() => menuLinks(nav.value?.legal))
const scrolled = useScrolled()
const address = computed(() => [settings.value?.address, settings.value?.town].filter(Boolean).join(', '))
</script>

<template>
  <footer class="bg-ink text-surface rounded-t-[36px] md:rounded-t-[56px]">
    <div class="wrap pt-16 md:pt-20 pb-28 md:pb-12">
      <div class="grid md:grid-cols-12 gap-x-10 gap-y-12">
        <div class="md:col-span-5">
          <p><ZrcadloWordmark large /></p>
          <p v-if="settings?.about" class="mt-5 max-w-[24rem] opacity-80">{{ tidyText(settings.about) }}</p>
        </div>
        <div class="md:col-span-3">
          <p class="text-[12px] font-semibold tracking-[.14em] uppercase opacity-70">{{ words.contact }}</p>
          <ul class="mt-4 space-y-1">
            <li v-if="phone"><a class="inline-flex items-center min-h-11 hover:underline underline-offset-4" :href="phone.href">{{ phone.text }}</a></li>
            <li v-if="settings?.email"><a class="inline-flex items-center min-h-11 hover:underline underline-offset-4 break-all" :href="`mailto:${settings.email}`">{{ settings.email }}</a></li>
            <li v-if="address" class="pt-2 opacity-80">{{ address }}</li>
          </ul>
        </div>
        <div v-if="settings?.instagram || settings?.facebook" class="md:col-span-2">
          <p class="text-[12px] font-semibold tracking-[.14em] uppercase opacity-70">{{ words.followUs }}</p>
          <ul class="mt-4 space-y-1">
            <li v-if="settings.instagram"><a class="inline-flex items-center gap-2 min-h-11 hover:underline underline-offset-4" :href="settings.instagram" target="_blank" rel="noopener"><UIcon name="i-lucide-instagram" aria-hidden="true" />Instagram</a></li>
            <li v-if="settings.facebook"><a class="inline-flex items-center gap-2 min-h-11 hover:underline underline-offset-4" :href="settings.facebook" target="_blank" rel="noopener"><UIcon name="i-lucide-facebook" aria-hidden="true" />Facebook</a></li>
          </ul>
        </div>
        <div class="md:col-span-2">
          <p class="text-[12px] font-semibold tracking-[.14em] uppercase opacity-70">{{ words.onTheWeb }}</p>
          <ul class="mt-4 space-y-1">
            <li><NuxtLink class="inline-flex items-center min-h-11 hover:underline underline-offset-4" :to="`/#${anchorOf('pricelist')}`">{{ words.priceList }}</NuxtLink></li>
            <li><NuxtLink class="inline-flex items-center min-h-11 hover:underline underline-offset-4" :to="`/#${anchorOf('booking')}`">{{ words.booking }}</NuxtLink></li>
            <li v-for="l in legal" :key="l.id"><NuxtLink class="inline-flex items-center min-h-11 hover:underline underline-offset-4" :to="l.url">{{ l.label }}</NuxtLink></li>
          </ul>
        </div>
      </div>
      <p v-if="settings?.legal" class="mt-14 pt-6 border-t border-white/20 text-sm opacity-70">{{ tidyText(settings.legal) }}</p>
    </div>
  </footer>

  <!-- Phone: the two things people come for, always at hand -->
  <div class="md:hidden fixed left-3 right-3 bottom-3 z-40 transition-transform duration-300 flex gap-2 p-2 rounded-full bg-surface shadow-[0_8px_30px_rgba(20,30,50,.22),0_0_0_1px_var(--line)]" :class="scrolled ? '' : 'translate-y-[140%]'" :aria-hidden="!scrolled">
    <a v-if="phone" :href="phone.href" class="flex-none w-12 h-12 rounded-full inline-flex items-center justify-center text-ink text-xl shadow-[inset_0_0_0_1px_var(--ink)]" :aria-label="words.callPhone(phone.text)" :tabindex="scrolled ? undefined : -1"><UIcon name="i-lucide-phone" aria-hidden="true" /></a>
    <NuxtLink :to="`/#${anchorOf('pricelist')}`" class="flex-1 h-12 rounded-full inline-flex items-center justify-center font-semibold text-ink shadow-[inset_0_0_0_1px_var(--ink)]" :tabindex="scrolled ? undefined : -1">{{ words.priceList }}</NuxtLink>
    <NuxtLink :to="`/#${anchorOf('booking')}`" class="flex-1 h-12 rounded-full inline-flex items-center justify-center font-semibold bg-brand text-brand-ink" :tabindex="scrolled ? undefined : -1">{{ words.order }}</NuxtLink>
  </div>
</template>
