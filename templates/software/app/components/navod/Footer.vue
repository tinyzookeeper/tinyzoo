<script setup lang="ts">
// Návod's footer: the mark and a line about the product, three columns of links, and the
// company's details in one mono line under a rule.
const { nav } = await useSite()
const { name, words, settings, legalLine, statusHost } = await useSoftware()
const columns = computed(() => [
  { id: 'product', title: words.value.footerProduct, links: menuLinks(nav.value?.product), span: 'lg:col-span-2' },
  { id: 'support', title: words.value.footerSupport, links: menuLinks(nav.value?.support), span: 'lg:col-span-3' },
  { id: 'legal', title: words.value.footerLegal, links: menuLinks(nav.value?.legal), span: 'lg:col-span-3' },
].filter((c) => c.links.length))
</script>

<template>
  <footer class="bg-ground">
    <div class="wrap grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-12 lg:gap-12">
      <div class="lg:col-span-4">
        <NuxtLink to="/" class="flex items-center gap-2.5 text-ink" :aria-label="words.toTop(name)"><NavodWordmark /></NuxtLink>
        <p v-if="settings?.footerText" class="mt-4 max-w-[22rem] text-[15px] text-quiet">{{ tidyText(settings.footerText) }}</p>
        <p v-if="settings?.statusUrl" class="mt-5 inline-flex items-center gap-2 font-mono text-[12px] text-ink"><span class="h-2 w-2 rounded-full bg-brand" />{{ words.statusRunning }} · <a class="link" :href="settings.statusUrl" target="_blank" rel="noopener">{{ statusHost }}</a></p>
      </div>
      <nav v-for="c in columns" :key="c.id" class="text-[15px]" :class="c.span" :aria-label="c.title">
        <p class="label text-quiet">{{ c.title }}</p>
        <ul class="mt-3">
          <li v-for="l in c.links" :key="l.id"><SiteLink class="inline-flex min-h-[36px] items-center text-ink hover:text-brand" :to="l.url">{{ l.label }}</SiteLink></li>
        </ul>
      </nav>
    </div>
    <div v-if="legalLine" class="border-t border-ink/15">
      <p class="wrap py-6 font-mono text-[12px] leading-relaxed text-quiet">{{ legalLine }}</p>
    </div>
  </footer>
</template>
