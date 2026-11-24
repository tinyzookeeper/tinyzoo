<script setup lang="ts">
// Dres's footer: the club colour again, three small columns and the club's name once more, as
// large as the width allows.
const { nav } = await useSite()
const { settings, name, words } = await useClub()
const links = computed(() => menuLinks(nav.value?.main))
const legal = computed(() => menuLinks(nav.value?.legal))
// (the same year on the server and in the browser, whenever the page is drawn)
const year = useState('club-year', () => new Date().getFullYear())
const legalName = computed(() => settings.value?.fullName || name.value)
</script>

<template>
  <footer class="stripes overflow-hidden bg-brand text-brand-ink">
    <div class="wrap grid gap-8 pb-6 pt-12 sm:grid-cols-3 lg:pt-16">
      <div class="text-[15px]">
        <p class="cap">{{ words.club_ }}</p>
        <p class="mt-3">{{ legalName }}<template v-if="settings?.address"><br>{{ settings.address }}</template><template v-if="settings?.companyId"><br>{{ words.companyId }} {{ settings.companyId }}</template></p>
      </div>
      <div class="text-[15px]">
        <p class="cap">{{ words.contact }}</p>
        <p class="mt-3">
          <a v-if="settings?.email" class="hover:underline" :href="`mailto:${settings.email}`">{{ settings.email }}</a>
          <template v-if="settings?.phone"><br><a class="hover:underline" :href="contactHref(settings.phone)">{{ settings.phone }}</a><template v-if="settings.phoneNote"> ({{ settings.phoneNote }})</template></template>
          <template v-if="settings?.facebook"><br><a class="hover:underline" :href="settings.facebook" target="_blank" rel="noopener">{{ words.facebook }}</a></template>
        </p>
      </div>
      <div class="text-[15px]">
        <p class="cap">{{ words.onSite }}</p>
        <p class="mt-3 flex flex-wrap gap-x-5 gap-y-1">
          <NuxtLink v-for="l in links" :key="l.id" class="hover:underline" :to="l.url">{{ l.label }}</NuxtLink>
          <NuxtLink v-for="l in legal" :key="l.id" class="hover:underline" :to="l.url">{{ l.label }}</NuxtLink>
        </p>
      </div>
    </div>
    <div class="wrap">
      <p class="wide mt-6" :class="byLength(name, [[16, 'text-[clamp(24px,6.8vw,100px)]'], [30, 'text-[clamp(20px,3.6vw,56px)]']], 'text-[clamp(18px,2.4vw,40px)]')" aria-hidden="true">{{ name }}</p>
      <p class="py-5 text-[13px]">{{ words.copyright(year, legalName) }}</p>
    </div>
  </footer>
</template>
