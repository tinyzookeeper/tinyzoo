<script setup lang="ts">
// Soutisk's footer: dark paper under a line of hills, the name, two lists of links, the
// organiser's contact details and a line of legal and social links.
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
  <footer class="on-dark relative bg-ink text-paper">
    <svg class="hills text-ink" viewBox="0 0 1440 120" preserveAspectRatio="none" aria-hidden="true"><use href="#soutisk-hl1" fill="currentColor" /></svg>
    <div class="wrap pt-6 pb-12 grid sm:grid-cols-2 lg:grid-cols-12 gap-x-8 gap-y-9">
      <div class="lg:col-span-5">
        <SoutiskWordmark large />
        <p v-if="settings?.tagline" class="mt-4 max-w-[24rem] text-paper/85">{{ tidyText(settings.tagline) }}</p>
      </div>
      <div v-if="race.length" class="lg:col-span-2">
        <h2 class="font-bold text-c2">{{ words.race }}</h2>
        <ul class="mt-1">
          <li v-for="l in race" :key="l.id"><NuxtLink class="inline-flex items-center min-h-11 hover:underline underline-offset-4 decoration-2" :to="l.url">{{ l.label }}</NuxtLink></li>
        </ul>
      </div>
      <div v-if="years.length" class="lg:col-span-2">
        <h2 class="font-bold text-c2">{{ words.editions }}</h2>
        <ul class="mt-1">
          <li v-for="l in years" :key="l.id"><NuxtLink class="inline-flex items-center min-h-11 hover:underline underline-offset-4 decoration-2" :to="l.url">{{ l.label }}</NuxtLink></li>
        </ul>
      </div>
      <div class="lg:col-span-3">
        <h2 class="font-bold text-c2">{{ words.contact }}</h2>
        <p class="mt-2.5 text-paper/85">{{ settings?.organizerName }}<template v-if="settings?.address"><br>{{ settings.address }}</template></p>
        <p class="mt-1">
          <a v-if="settings?.phone" :href="telHref(settings.phone)" class="inline-flex items-center min-h-11 hover:underline underline-offset-4 decoration-2">{{ settings.phone }}</a><br v-if="settings?.phone">
          <a v-if="settings?.email" :href="`mailto:${settings.email}`" class="inline-flex items-center min-h-11 hover:underline underline-offset-4 decoration-2 break-all">{{ settings.email }}</a>
        </p>
      </div>
    </div>
    <div class="border-t-2 border-paper/15">
      <div class="wrap py-5 flex flex-wrap justify-between gap-x-8 gap-y-2 text-sm text-paper/80">
        <p>{{ words.copyright(year, settings?.organizerName ?? '') }}</p>
        <p class="flex flex-wrap gap-x-6">
          <NuxtLink v-for="l in legal" :key="l.id" :to="l.url" class="hover:text-paper hover:underline underline-offset-4">{{ l.label }}</NuxtLink>
          <a v-for="s in settings?.social ?? []" :key="s.id" :href="s.url" target="_blank" rel="noopener" class="hover:text-paper hover:underline underline-offset-4">{{ s.label }}</a>
        </p>
      </div>
    </div>
  </footer>
</template>
