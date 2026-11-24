<script setup lang="ts">
// Vizitka's footer: ink-coloured, in four columns (who, the menu, how to reach, the networks),
// then the legal line with the link to the privacy page.
const { nav } = await useSite()
const { settings, name, words, socials, year } = await useProfile()
const links = computed(() => menuLinks(nav.value?.main))
const legal = computed(() => menuLinks(nav.value?.legal))
const legalLine = computed(() => [settings.value?.legalName || name.value, settings.value?.companyId ? `IČO ${settings.value.companyId}` : '', settings.value?.legalNote].filter(Boolean).join(' · '))
</script>

<template>
  <footer class="bg-ink text-paper">
    <div class="wrap py-14 lg:py-16 grid sm:grid-cols-2 lg:grid-cols-12 gap-x-10 gap-y-10">
      <div class="lg:col-span-5">
        <p><VizitkaWordmark footer /></p>
        <p v-if="settings?.shortDescription" class="mt-3 max-w-[24rem] opacity-80">{{ czText(settings.shortDescription) }}</p>
      </div>
      <nav v-if="links.length" class="lg:col-span-2" :aria-label="words.footerMenu">
        <p class="label opacity-70">{{ words.web }}</p>
        <ul class="mt-3">
          <li v-for="l in links" :key="l.id"><NuxtLink class="inline-flex min-h-[44px] items-center hover:underline underline-offset-4" :to="l.url" :target="l.newTab ? '_blank' : undefined">{{ czText(l.label) }}</NuxtLink></li>
        </ul>
      </nav>
      <div class="lg:col-span-3">
        <p class="label opacity-70">{{ words.contact }}</p>
        <ul class="mt-3">
          <li v-if="settings?.phone"><a class="inline-flex min-h-[44px] items-center hover:underline underline-offset-4" :href="telHref(settings.phone)">{{ tidyText(settings.phone) }}</a></li>
          <li v-if="settings?.email"><a class="inline-flex min-h-[44px] items-center hover:underline underline-offset-4 break-all" :href="`mailto:${settings.email}`">{{ settings.email }}</a></li>
          <li v-if="settings?.address" class="min-h-[44px] flex items-center">{{ tidyText(settings.address) }}</li>
        </ul>
      </div>
      <div v-if="socials.length" class="lg:col-span-2">
        <p class="label opacity-70">{{ words.social }}</p>
        <ul class="mt-3">
          <li v-for="s in socials" :key="s.id"><a class="inline-flex min-h-[44px] items-center gap-2 hover:underline underline-offset-4" :href="s.url" target="_blank" rel="noopener"><UIcon :name="s.icon" aria-hidden="true" /> {{ s.label }}</a></li>
        </ul>
      </div>
    </div>
    <div class="wrap pb-10">
      <div class="border-t border-paper/20 pt-4 flex flex-wrap items-center gap-x-8 gap-y-1 justify-between text-[0.9rem] opacity-80">
        <p>{{ tidyText(legalLine) }}</p>
        <p class="flex items-center gap-2">
          <template v-for="l in legal" :key="l.id"><NuxtLink class="inline-flex min-h-[44px] items-center hover:underline underline-offset-4" :to="l.url">{{ czText(l.label) }}</NuxtLink> ·</template>
          © {{ year }}
        </p>
      </div>
    </div>
  </footer>
</template>
