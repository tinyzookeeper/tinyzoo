<script setup lang="ts">
// Rozhovor's footer: on the page's own paper, the mark and the name, the menu in two columns
// (with the contact and the privacy page), the networks as round buttons and the legal line.
const { nav } = await useSite()
const { settings, name, words, cta, socials, year } = await useProfile()
const links = computed(() => [
  ...menuLinks(nav.value?.main),
  ...(cta.value ? [{ id: 'contact', label: words.value.contact, url: cta.value.url, newTab: false }] : []),
  ...menuLinks(nav.value?.legal),
])
const legalLine = computed(() => [settings.value?.legalName || name.value, settings.value?.companyId ? `IČO ${settings.value.companyId}` : '', settings.value?.legalNote].filter(Boolean).join(' · '))
</script>

<template>
  <footer class="wrap pt-14 lg:pt-16 pb-10">
    <div class="grid sm:grid-cols-2 lg:grid-cols-12 gap-x-10 gap-y-8">
      <div class="lg:col-span-5">
        <p><RozhovorWordmark footer /></p>
        <p v-if="settings?.shortDescription" class="mt-3 max-w-[24rem]">{{ czText(settings.shortDescription) }}</p>
      </div>
      <nav class="lg:col-span-4" :aria-label="words.footerMenu">
        <ul class="grid grid-cols-2 gap-x-6 text-ink font-medium">
          <li v-for="l in links" :key="l.id"><NuxtLink class="inline-flex min-h-[44px] items-center hover:text-brand transition-colors" :to="l.url" :target="l.newTab ? '_blank' : undefined">{{ czText(l.label) }}</NuxtLink></li>
        </ul>
      </nav>
      <ul v-if="socials.length" class="lg:col-span-3 flex gap-3 lg:justify-end content-start">
        <li v-for="s in socials" :key="s.id"><a class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-card text-ink hover:bg-ink hover:text-card transition-colors" :href="s.url" :aria-label="s.label" target="_blank" rel="noopener"><UIcon :name="s.icon" class="text-[1.2rem]" aria-hidden="true" /></a></li>
      </ul>
    </div>
    <p class="mt-10 pt-6 border-t border-tint text-[1rem] text-quiet">{{ tidyText(legalLine) }} · © {{ year }}</p>
  </footer>
</template>
