<script setup lang="ts">
// Hřiště's footer: the dark green of the pitch with its chalk lines faintly drawn, the club, how
// to reach it, and a line with the copyright and the motto.
const { nav } = await useSite()
const { settings, name, words } = await useClub()
const legal = computed(() => menuLinks(nav.value?.legal))
// (the same year on the server and in the browser, whenever the page is drawn)
const year = useState('club-year', () => new Date().getFullYear())
const legalName = computed(() => settings.value?.fullName || name.value)
const title = computed(() => beforeComma(legalName.value))
</script>

<template>
  <footer class="on-dark relative overflow-hidden bg-pitch text-white">
    <svg viewBox="0 0 700 420" class="chalk -right-24 -top-10 w-[620px] opacity-[.1] max-md:hidden" aria-hidden="true"><path d="M0 60h700M250 60v230h380V60M360 60v90h160V60" /><path d="M360 290a110 110 0 0 0 160 0" /><circle cx="440" cy="215" r="5" fill="currentColor" /></svg>
    <div class="wrap relative grid gap-x-10 gap-y-8 py-12 md:grid-cols-[1.4fr_1fr_1fr] lg:py-16">
      <div>
        <p class="flex items-center gap-3"><HristeWordmark crest /><span class="disp !text-white text-[26px]">{{ title }}</span></p>
        <p v-if="settings?.footerText" class="mt-4 max-w-xs text-[16px] text-white/75">{{ tidyText(settings.footerText) }}</p>
      </div>
      <p class="text-[16px] text-white/75"><span class="mb-2 block font-display font-extrabold text-white">{{ words.club_ }}</span>{{ legalName }}<template v-if="settings?.address"><br>{{ settings.address }}</template><template v-if="settings?.companyId"><br>{{ words.companyId }} {{ settings.companyId }}</template></p>
      <p class="text-[16px] text-white/75">
        <span class="mb-2 block font-display font-extrabold text-white">{{ words.contact }}</span>
        <a v-if="settings?.email" class="hover:text-white hover:underline" :href="`mailto:${settings.email}`">{{ settings.email }}</a>
        <template v-if="settings?.phone"><br><a class="hover:text-white hover:underline" :href="contactHref(settings.phone)">{{ settings.phone }}</a><template v-if="settings.phoneNote"> ({{ settings.phoneNote }})</template></template>
        <template v-if="settings?.facebook || legal.length"><br><a v-if="settings?.facebook" class="hover:text-white hover:underline" :href="settings.facebook" target="_blank" rel="noopener">{{ words.facebook }}</a><template v-if="settings?.facebook && legal.length"> · </template><template v-for="(l, i) in legal" :key="l.id"><template v-if="i"> · </template><NuxtLink class="hover:text-white hover:underline" :to="l.url">{{ l.label }}</NuxtLink></template></template>
      </p>
    </div>
    <div class="wrap relative"><p class="border-t border-white/20 py-5 text-[14.5px] text-white/70">{{ words.copyright(year, legalName) }}<template v-if="settings?.motto"> · {{ settings.motto }}</template></p></div>
  </footer>
</template>
