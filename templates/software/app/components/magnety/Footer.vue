<script setup lang="ts">
// Magnets' footer: dark, the name and a line about the product, three columns of links in the
// display type, and the company's details under a rule.
const { nav } = await useSite()
const { name, words, settings, legalLine } = await useSoftware()
const columns = computed(() => [
  { id: 'product', title: words.value.footerProduct, links: menuLinks(nav.value?.product), span: 'lg:col-span-2 lg:col-start-6' },
  { id: 'support', title: words.value.footerSupport, links: menuLinks(nav.value?.support), span: 'lg:col-span-2' },
  { id: 'legal', title: words.value.footerLegal, links: menuLinks(nav.value?.legal), span: 'lg:col-span-3' },
].filter((c) => c.links.length))
</script>

<template>
  <footer class="on-dark bg-ink text-cream">
    <div class="wrap grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-12">
      <div class="lg:col-span-4">
        <NuxtLink to="/" class="flex items-center gap-2" :aria-label="words.toTop(name)"><MagnetyWordmark footer /></NuxtLink>
        <p v-if="settings?.footerText" class="mt-4 max-w-[22rem] text-[16px] opacity-80">{{ tidyText(settings.footerText) }}</p>
        <p v-if="settings?.statusUrl" class="mono mt-5 inline-flex items-center gap-2 rounded-full bg-cream/10 px-3 py-2"><span class="h-2 w-2 rounded-full bg-brand" />{{ words.statusRunning }}</p>
      </div>
      <nav v-for="c in columns" :key="c.id" :class="c.span" :aria-label="c.title">
        <p class="mono opacity-70">{{ c.title }}</p>
        <ul class="mt-3 font-display text-[18px] font-bold">
          <li v-for="l in c.links" :key="l.id"><SiteLink class="inline-flex min-h-[40px] items-center hover:underline" :to="l.url">{{ l.label }}</SiteLink></li>
        </ul>
      </nav>
    </div>
    <div v-if="legalLine" class="border-t border-cream/20">
      <p class="wrap py-6 text-[14px] leading-relaxed opacity-80">{{ legalLine }}</p>
    </div>
  </footer>
</template>
