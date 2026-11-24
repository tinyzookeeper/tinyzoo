<script setup lang="ts">
// One Day's footer: the last entry of the day, on the night: the name and a line about the product,
// three columns of links, and the company's details under a rule.
const { nav } = await useSite()
const { name, words, settings, legalLine, statusHost } = await useSoftware()
const columns = computed(() => [
  { id: 'product', title: words.value.footerProduct, links: menuLinks(nav.value?.product), span: 'lg:col-span-2 lg:col-start-6' },
  { id: 'support', title: words.value.footerSupport, links: menuLinks(nav.value?.support), span: 'lg:col-span-2' },
  { id: 'legal', title: words.value.footerLegal, links: menuLinks(nav.value?.legal), span: 'lg:col-span-3' },
].filter((c) => c.links.length))
</script>

<template>
  <footer class="dark-band bg-night text-cream">
    <div class="border-t border-cream/20">
      <div class="wrap grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-12">
        <div class="lg:col-span-4">
          <NuxtLink to="/" class="flex items-center gap-2.5" :aria-label="words.toTop(name)"><JedenDenWordmark /></NuxtLink>
          <p v-if="settings?.footerText" class="mt-4 max-w-[22rem] text-[16px] opacity-85">{{ tidyText(settings.footerText) }}</p>
          <p v-if="settings?.statusUrl" class="time mt-5 inline-flex items-center gap-2"><span class="h-2 w-2 rounded-full bg-lamp" />{{ words.statusRunning }} · <a class="ul" :href="settings.statusUrl" target="_blank" rel="noopener">{{ statusHost }}</a></p>
        </div>
        <nav v-for="c in columns" :key="c.id" class="text-[16px]" :class="c.span" :aria-label="c.title">
          <p class="time opacity-75">{{ c.title }}</p>
          <ul class="mt-3">
            <li v-for="l in c.links" :key="l.id"><SiteLink class="inline-flex min-h-[38px] items-center hover:text-lamp" :to="l.url">{{ l.label }}</SiteLink></li>
          </ul>
        </nav>
      </div>
      <p v-if="legalLine" class="wrap border-t border-cream/15 py-6 text-[14px] leading-relaxed opacity-80">{{ legalLine }}</p>
    </div>
  </footer>
</template>
