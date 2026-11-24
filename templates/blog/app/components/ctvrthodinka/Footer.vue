<script setup lang="ts">
// Čtvrthodinka's footer: the name with its clock set large, the sections, where to follow, the
// publisher, the fine print.
const { nav } = await useSite()
const { settings, words } = await useBlog()
const sections = await useSections()
const articles = await useArticles()
const legal = computed(() => menuLinks(nav.value?.legal))
const social = computed(() => settings.value?.social ?? [])
const years = computed(() => yearsOf(articles.value, settings.value?.foundedYear))
const lines = computed(() => [
  settings.value?.publisher ?? '',
  settings.value?.address ?? '',
  settings.value?.companyId ? `${words.value.companyId} ${settings.value.companyId}` : '',
  settings.value?.registration ?? '',
].filter(Boolean))
</script>

<template>
  <footer class="wrap py-12 lg:py-16">
    <div class="grid gap-x-12 gap-y-10 lg:grid-cols-12">
      <div class="lg:col-span-5">
        <CtvrthodinkaWordmark size="[--size:2.6rem] lg:[--size:3.6rem]" text="text-[3.2rem] lg:text-[4.6rem]" />
        <p class="stand mt-4 text-[1.2rem] text-quiet">{{ [settings?.tagline, settings?.footerNote].filter(Boolean).join('. ') }}</p>
      </div>
      <nav v-if="sections.length" :aria-label="words.footerSections" class="lg:col-span-2">
        <h2 class="meta font-bold uppercase tracking-[0.08em]">{{ words.sections }}</h2>
        <ul class="mt-2 font-semibold">
          <li v-for="s in sections" :key="s.id"><NuxtLink class="inline-flex h-11 items-center lg:h-9" :to="`/rubrika/${s.slug}`"><span class="lift">{{ s.name }}</span></NuxtLink></li>
        </ul>
      </nav>
      <div class="lg:col-span-2">
        <h2 class="meta font-bold uppercase tracking-[0.08em]">{{ words.subscribe }}</h2>
        <ul class="mt-2 font-semibold">
          <li v-if="settings?.ctaUrl"><NuxtLink class="inline-flex h-11 items-center lg:h-9" :to="siteHref(settings.ctaUrl)"><span class="lift">{{ settings.ctaLabel || words.newsletter }}</span></NuxtLink></li>
          <li v-for="s in social" :key="s.id"><a class="inline-flex h-11 items-center lg:h-9" :href="s.url ?? undefined" target="_blank" rel="noopener"><span class="lift">{{ s.label }}</span></a></li>
        </ul>
      </div>
      <div v-if="lines.length" class="lg:col-span-3">
        <h2 class="meta font-bold uppercase tracking-[0.08em]">{{ words.publisher }}</h2>
        <p class="mt-3 text-[0.98rem] font-medium leading-[1.6]"><template v-for="(line, i) in lines" :key="i"><template v-if="i"><br></template>{{ line }}</template></p>
      </div>
    </div>
    <div class="meta mt-10 flex flex-col gap-2 border-t border-rule pt-6 sm:flex-row sm:justify-between">
      <p>© {{ years }} {{ settings?.siteName }}. {{ settings?.copyNote }}</p>
      <p v-if="legal.length"><template v-for="(l, i) in legal" :key="l.id"><template v-if="i"> · </template><NuxtLink class="inline-flex h-11 items-center sm:h-auto" :to="l.url"><span class="lift">{{ l.label }}</span></NuxtLink></template></p>
    </div>
  </footer>
</template>
