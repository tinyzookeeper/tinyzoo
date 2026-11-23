<script setup lang="ts">
// Salon's footer: the name and a brass ornament, the address, the contact and the hours in three
// columns, then the company line and the two social links.
const { nav } = await useSite()
const { settings, words, week, tel, phone, now } = await useRestaurant()
const legal = computed(() => menuLinks(nav.value?.legal))
const summary = computed(() => hoursSummary(week.value, words.value.shortDays))
// (two lines: the first half of the groups, then the rest)
const lines = computed(() => {
  const cut = Math.ceil(summary.value.length / 2)
  return [summary.value.slice(0, cut).join(', '), summary.value.slice(cut).join(', ')].filter(Boolean)
})
const year = computed(() => clockOf(now.value).date.slice(0, 4))
const postal = computed(() => [settings.value?.street, [settings.value?.postalCode, settings.value?.city].filter(Boolean).join(' ')].filter(Boolean).join(', '))
const company = computed(() => [settings.value?.operator ? words.value.copyright(year.value, settings.value.operator) : '', settings.value?.companyId ? `${words.value.companyId} ${settings.value.companyId}` : ''].filter(Boolean).join(' · '))
</script>

<template>
  <footer class="border-t border-line">
    <div class="wrap py-14 lg:py-20">
      <div class="text-center">
        <SalonWordmark size="footer" tagline />
        <div class="orn mt-7"><i /></div>
      </div>
      <div class="mt-10 grid sm:grid-cols-3 gap-10 text-center sm:text-left">
        <div>
          <p class="label text-brand">{{ words.address }}</p>
          <p v-if="postal" class="mt-3">{{ postal }}</p>
          <p v-if="settings?.addressNote" class="text-quiet">{{ tidyText(settings.addressNote) }}</p>
        </div>
        <div class="sm:text-center">
          <p class="label text-brand">{{ words.contact }}</p>
          <p v-if="phone" class="mt-3"><a class="link" :href="tel">{{ phone }}</a></p>
          <p v-if="settings?.email"><a class="link break-all" :href="`mailto:${settings.email}`">{{ settings.email }}</a></p>
        </div>
        <div v-if="lines.length" class="sm:text-right">
          <p class="label text-brand">{{ words.openingHours }}</p>
          <p class="mt-3">{{ lines[0] }}</p>
          <p v-if="lines[1]" class="text-quiet">{{ lines[1] }}</p>
        </div>
      </div>
      <div class="mt-12 pt-7 border-t border-line flex flex-col sm:flex-row items-center justify-between gap-5 text-[.95rem] text-quiet">
        <p>
          {{ company }}
          <template v-for="l in legal" :key="l.id"><template v-if="company || l !== legal[0]"> · </template><NuxtLink class="hover:text-brand" :to="l.url">{{ l.label }}</NuxtLink></template>
        </p>
        <div class="flex items-center gap-2">
          <a v-if="settings?.instagram" class="inline-flex items-center gap-2 min-h-11 px-3 hover:text-brand transition-colors" :href="settings.instagram" target="_blank" rel="noopener"><UIcon name="i-lucide-instagram" class="text-lg" aria-hidden="true" /> Instagram</a>
          <a v-if="settings?.facebook" class="inline-flex items-center gap-2 min-h-11 px-3 hover:text-brand transition-colors" :href="settings.facebook" target="_blank" rel="noopener"><UIcon name="i-lucide-facebook" class="text-lg" aria-hidden="true" /> Facebook</a>
        </div>
      </div>
    </div>
  </footer>
</template>
