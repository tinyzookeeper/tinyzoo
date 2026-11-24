<script setup lang="ts">
// Paragon's footer: the same ink as the printing, a dark band with the name, the address, the
// contact and the social links, and the company line with the hours under a dashed rule.
const { nav } = await useSite()
const { settings, name, words, week, tel, phone, now } = await useRestaurant()
const legal = computed(() => menuLinks(nav.value?.legal))
const hours = computed(() => hoursSummary(week.value, words.value.shortDays).join(', '))
const year = computed(() => clockOf(now.value).date.slice(0, 4))
const company = computed(() => [
  settings.value?.operator ? words.value.copyright(year.value, settings.value.operator) : '',
  settings.value?.companyId ? `${words.value.companyId} ${settings.value.companyId}` : '',
  hours.value,
].filter(Boolean).join(' · '))
</script>

<template>
  <footer class="on-ink bg-ink text-sheet">
    <div class="wrap py-12 lg:py-16">
      <div class="grid sm:grid-cols-2 lg:grid-cols-12 gap-x-10 gap-y-9">
        <div class="lg:col-span-4">
          <p class="font-display font-black text-[3rem] leading-none tracking-[-.02em]">{{ name }}</p>
          <p v-if="settings?.tagline" class="mt-3">{{ tidyText(taglineWithAnd(settings.tagline)) }}<template v-if="settings.city">, {{ settings.city }}</template></p>
          <svg class="mt-5 h-7" viewBox="0 0 90 30" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
            <path d="M6 4l-1 22M14 3l0 23M22 5l-1 21M30 4l1 22M1 20L35 8M50 4l-1 22M58 3l0 23M66 5l-1 21" />
          </svg>
        </div>
        <div class="lg:col-span-3">
          <p class="font-bold uppercase tracking-[.1em] text-[.88rem]">{{ words.paragon.slip.where }}</p>
          <p class="mt-2">{{ settings?.street }}<br>{{ [settings?.postalCode, settings?.city].filter(Boolean).join(' ') }}</p>
        </div>
        <div class="lg:col-span-3">
          <p class="font-bold uppercase tracking-[.1em] text-[.88rem]">{{ words.contact }}</p>
          <p class="mt-2"><a v-if="phone" class="tlink" :href="tel">{{ phone }}</a><br><a v-if="settings?.email" class="tlink break-all" :href="`mailto:${settings.email}`">{{ settings.email }}</a></p>
        </div>
        <div v-if="settings?.instagram || settings?.facebook" class="lg:col-span-2">
          <p class="font-bold uppercase tracking-[.1em] text-[.88rem]">{{ words.followUs }}</p>
          <p class="mt-0.5 flex flex-col items-start">
            <a v-if="settings?.instagram" class="inline-flex items-center gap-2.5 min-h-11 tlink" :href="settings.instagram" target="_blank" rel="noopener"><UIcon name="i-lucide-instagram" class="text-lg" aria-hidden="true" /> Instagram</a>
            <a v-if="settings?.facebook" class="inline-flex items-center gap-2.5 min-h-11 tlink" :href="settings.facebook" target="_blank" rel="noopener"><UIcon name="i-lucide-facebook" class="text-lg" aria-hidden="true" /> Facebook</a>
          </p>
        </div>
      </div>
      <p class="mt-10 pt-5 border-t border-dashed border-[color-mix(in_srgb,var(--sheet)_45%,transparent)] text-[.92rem]">
        {{ company }}
        <template v-for="l in legal" :key="l.id"> · <NuxtLink class="tlink" :to="l.url">{{ l.label }}</NuxtLink></template>
      </p>
    </div>
  </footer>
</template>
