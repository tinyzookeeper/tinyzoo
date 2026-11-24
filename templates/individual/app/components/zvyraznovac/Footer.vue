<script setup lang="ts">
// Zvýrazňovač's footer: it goes on from the black contact section, a heavy rule, the name,
// the menu and the networks in mono capitals, and the legal line.
const { nav } = await useSite()
const { settings, name, words, socials, year } = await useProfile()
const links = computed(() => menuLinks(nav.value?.main))
const legal = computed(() => menuLinks(nav.value?.legal))
const legalLine = computed(() => [settings.value?.legalName || name.value, settings.value?.companyId ? `IČO ${settings.value.companyId}` : '', settings.value?.legalNote].filter(Boolean).join(' · '))
</script>

<template>
  <footer class="bg-ink text-paper on-ink">
    <div class="wrap pb-10">
      <div class="border-t-2 border-paper/30 pt-8 grid sm:grid-cols-2 lg:grid-cols-12 gap-x-10 gap-y-8">
        <div class="lg:col-span-5">
          <p><ZvyraznovacWordmark footer /></p>
          <p v-if="settings?.shortDescription" class="mt-2 max-w-[22rem] opacity-80">{{ czText(settings.shortDescription) }}</p>
        </div>
        <nav v-if="links.length" class="lg:col-span-3 mono" :aria-label="words.footerMenu">
          <ul class="grid grid-cols-2 gap-x-6">
            <li v-for="l in links" :key="l.id"><NuxtLink class="inline-flex min-h-[44px] items-center hover:text-brand transition-colors" :to="l.url" :target="l.newTab ? '_blank' : undefined">{{ czText(l.label) }}</NuxtLink></li>
          </ul>
        </nav>
        <ul v-if="socials.length" class="lg:col-span-4 mono flex flex-wrap gap-x-7 lg:justify-end content-start">
          <li v-for="s in socials" :key="s.id"><a class="inline-flex min-h-[44px] items-center gap-2 hover:text-brand transition-colors" :href="s.url" target="_blank" rel="noopener"><UIcon :name="s.icon" class="text-[1.1rem]" aria-hidden="true" /> {{ s.label }}</a></li>
        </ul>
      </div>
      <div class="mt-6 flex flex-wrap items-center gap-x-8 gap-y-1 justify-between mono opacity-75">
        <p>{{ tidyText(legalLine) }}</p>
        <p class="flex items-center gap-2">
          <template v-for="l in legal" :key="l.id"><NuxtLink class="inline-flex min-h-[44px] items-center hover:text-brand transition-colors" :to="l.url">{{ czText(l.label) }}</NuxtLink> ·</template>
          © {{ year }}
        </p>
      </div>
    </div>
  </footer>
</template>
