<script setup lang="ts">
// Zpravodaj's footer: on a tint, the club, how to reach it, the pages, and a line with the
// copyright and the legal links.
const { nav } = await useSite()
const { settings, name, words } = await useClub()
const links = computed(() => menuLinks(nav.value?.main))
const legal = computed(() => menuLinks(nav.value?.legal))
// (the same year on the server and in the browser, whenever the page is drawn)
const year = useState('club-year', () => new Date().getFullYear())
const legalName = computed(() => settings.value?.fullName || name.value)
</script>

<template>
  <footer class="border-t border-ink bg-tint">
    <div class="wrap grid gap-10 py-12 md:grid-cols-[1.4fr_1fr_1fr]">
      <div>
        <p class="font-display text-[26px] font-extrabold leading-none tracking-tight text-ink">{{ name }}</p>
        <p v-if="settings?.footerText" class="mt-4 max-w-xs text-[15px]">{{ settings.fullName }} {{ tidyText(settings.footerText) }}</p>
        <p v-if="settings?.companyId" class="mt-4 text-[15px]">{{ words.companyId }} {{ settings.companyId }}</p>
      </div>
      <div class="text-[15px]">
        <p class="label">{{ words.contact }}</p>
        <p v-if="settings?.address" class="mt-3">{{ settings.address }}</p>
        <p v-if="settings?.email" class="mt-1"><a class="hover:text-brand" :href="`mailto:${settings.email}`">{{ settings.email }}</a></p>
        <p v-if="settings?.phone" class="mt-1"><a class="num hover:text-brand" :href="contactHref(settings.phone)">{{ settings.phone }}</a><template v-if="settings.phoneNote"> ({{ settings.phoneNote }})</template></p>
      </div>
      <div class="text-[15px]">
        <p class="label">{{ words.onSite }}</p>
        <ul class="mt-3 grid grid-cols-2 gap-x-6 gap-y-1">
          <li v-for="l in links" :key="l.id"><NuxtLink class="hover:text-brand" :to="l.url">{{ l.label }}</NuxtLink></li>
          <li v-if="settings?.facebook"><a class="hover:text-brand" :href="settings.facebook" target="_blank" rel="noopener">{{ words.facebook }}</a></li>
        </ul>
      </div>
    </div>
    <div class="border-t border-line">
      <div class="wrap flex flex-wrap justify-between gap-x-8 gap-y-1 py-5 text-[13px] text-quiet">
        <p>{{ words.copyright(year, legalName) }}</p>
        <p v-if="legal.length">
          <template v-for="(l, i) in legal" :key="l.id"><template v-if="i"> · </template><NuxtLink class="hover:text-brand" :to="l.url">{{ l.label }}</NuxtLink></template>
        </p>
      </div>
    </div>
  </footer>
</template>
