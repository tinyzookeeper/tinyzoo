<script setup lang="ts">
// Talíř's footer: on black, four columns (address, contact, hours, social), the company line, and
// under them the name set across the whole width.
const { nav } = await useSite()
const { settings, name, words, week, tel, phone, now, address } = await useRestaurant()
const legal = computed(() => menuLinks(nav.value?.legal))
const summary = computed(() => hoursSummary(week.value, words.value.shortDays))
const lines = computed(() => {
  const cut = Math.ceil(summary.value.length / 2)
  return [summary.value.slice(0, cut).join(', '), summary.value.slice(cut).join(', ')].filter(Boolean)
})
const year = computed(() => clockOf(now.value).date.slice(0, 4))
const postal = computed(() => [settings.value?.street, [settings.value?.postalCode, settings.value?.city].filter(Boolean).join(' ')].filter(Boolean).join(', '))
const company = computed(() => [
  settings.value?.operator ? words.value.copyright(year.value, settings.value.operator) : '',
  settings.value?.companyId ? `${words.value.companyId} ${settings.value.companyId}` : '',
  address.value ? words.value.talir.premises(address.value) : '',
].filter(Boolean).join(' · '))
// (the name is set as wide as the page: a longer one needs a smaller size to fit)
const size = computed(() => byLength(name.value, [[4, 'text-[min(22.6vw,20.6rem)]'], [6, 'text-[min(15vw,13.7rem)]'], [9, 'text-[min(10vw,9.2rem)]'], [14, 'text-[min(6.5vw,6rem)]']], 'text-[min(4.4vw,4rem)]'))
</script>

<template>
  <footer class="on-ink bg-ink text-paper overflow-hidden">
    <div class="wrap pt-14 lg:pt-20">
      <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-10 gap-y-9">
        <div>
          <p class="cap text-pop">{{ words.address }}</p>
          <p class="mt-3">{{ name }}<template v-if="settings?.tagline">, {{ taglineWithAnd(settings.tagline) }}</template><br>{{ postal }}</p>
        </div>
        <div>
          <p class="cap text-pop">{{ words.contact }}</p>
          <p class="mt-3"><a v-if="phone" class="ulink" :href="tel">{{ phone }}</a><br><a v-if="settings?.email" class="ulink break-all" :href="`mailto:${settings.email}`">{{ settings.email }}</a></p>
        </div>
        <div v-if="lines.length">
          <p class="cap text-pop">{{ words.openingHours }}</p>
          <p class="mt-3">{{ lines[0] }}<template v-if="lines[1]"><br>{{ lines[1] }}</template></p>
        </div>
        <div v-if="settings?.instagram || settings?.facebook">
          <p class="cap text-pop">{{ words.followUs }}</p>
          <p class="mt-1.5 flex flex-col items-start">
            <a v-if="settings?.instagram" class="inline-flex items-center gap-2.5 min-h-11 ulink" :href="settings.instagram" target="_blank" rel="noopener"><UIcon name="i-lucide-instagram" class="text-xl" aria-hidden="true" /> Instagram</a>
            <a v-if="settings?.facebook" class="inline-flex items-center gap-2.5 min-h-11 ulink" :href="settings.facebook" target="_blank" rel="noopener"><UIcon name="i-lucide-facebook" class="text-xl" aria-hidden="true" /> Facebook</a>
          </p>
        </div>
      </div>
      <p class="mt-12 pt-5 border-t-2 border-[color-mix(in_srgb,var(--paper)_35%,transparent)] muted text-[.95rem]">
        {{ company }}
        <template v-for="l in legal" :key="l.id"> · <NuxtLink class="hover:text-pop" :to="l.url">{{ l.label }}</NuxtLink></template>
      </p>
      <p class="wide text-pop text-center !leading-[.8] mt-9 -mb-[.07em] whitespace-nowrap select-none [font-stretch:150%]" :class="size" aria-hidden="true">{{ name }}</p>
    </div>
  </footer>
</template>
