<script setup lang="ts">
// Časomíra's footer: the name and a description, two lists of links, the organiser's contact
// details, and a line of legal and social links.
const { nav } = await useSite()
const { settings, words, day } = await useEvent()
const race = computed(() => menuLinks(nav.value?.race))
const years = computed(() => menuLinks(nav.value?.years))
const legal = computed(() => menuLinks(nav.value?.legal))
// The year of the line below: the date's until the browser says the real one (the server and
// the first drawing agree).
const year = ref(day.value ? Number(day.value.year) - 1 : 2026)
onMounted(() => { year.value = new Date().getFullYear() })
</script>

<template>
  <footer class="border-t border-line text-[0.98rem]">
    <div class="wrap py-12 grid sm:grid-cols-2 lg:grid-cols-12 gap-x-8 gap-y-9">
      <div class="lg:col-span-5">
        <CasomiraWordmark large />
        <p v-if="settings?.tagline" class="mt-4 max-w-[24rem] text-quiet">{{ tidyText(settings.tagline) }}</p>
      </div>
      <div v-if="race.length" class="lg:col-span-2">
        <h2 class="mono text-quiet">{{ words.race }}</h2>
        <ul class="mt-2">
          <li v-for="l in race" :key="l.id"><NuxtLink class="navlink" :to="l.url">{{ l.label }}</NuxtLink></li>
        </ul>
      </div>
      <div v-if="years.length" class="lg:col-span-2">
        <h2 class="mono text-quiet">{{ words.editions }}</h2>
        <ul class="mt-2">
          <li v-for="l in years" :key="l.id"><NuxtLink class="navlink" :to="l.url">{{ l.label }}</NuxtLink></li>
        </ul>
      </div>
      <div class="lg:col-span-3">
        <h2 class="mono text-quiet">{{ words.contact }}</h2>
        <p class="mt-3 text-quiet">{{ settings?.organizerName }}<template v-if="settings?.address"><br>{{ settings.address }}</template></p>
        <p class="mt-1">
          <a v-if="settings?.phone" :href="telHref(settings.phone)" class="navlink">{{ settings.phone }}</a><br v-if="settings?.phone">
          <a v-if="settings?.email" :href="`mailto:${settings.email}`" class="navlink break-all">{{ settings.email }}</a>
        </p>
      </div>
    </div>
    <div class="border-t border-line">
      <div class="wrap py-5 flex flex-wrap justify-between gap-x-8 gap-y-2 mono text-quiet">
        <p>{{ words.copyright(year, settings?.organizerName ?? '') }}</p>
        <p class="flex flex-wrap gap-x-6">
          <NuxtLink v-for="l in legal" :key="l.id" :to="l.url" class="hover:text-text">{{ l.label }}</NuxtLink>
          <a v-for="s in settings?.social ?? []" :key="s.id" :href="s.url" target="_blank" rel="noopener" class="hover:text-text">{{ s.label }}</a>
        </p>
      </div>
    </div>
  </footer>
</template>
