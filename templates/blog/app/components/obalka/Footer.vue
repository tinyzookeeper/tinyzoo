<script setup lang="ts">
// Obálka's imprint: the name, the sections, where to follow, the publisher, the fine print.
const { nav } = await useSite()
const { settings, words } = await useBlog()
const sections = await useSections()
const articles = await useArticles()
const legal = computed(() => menuLinks(nav.value?.legal))
const social = computed(() => settings.value?.social ?? [])
const years = computed(() => yearsOf(articles.value, settings.value?.foundedYear))
const lines = computed(() => [
  settings.value?.publisher ? words.value.publishedBy(settings.value.publisher) : '',
  settings.value?.address ?? '',
  settings.value?.companyId ? `${words.value.companyId} ${settings.value.companyId}` : '',
  settings.value?.registration ?? '',
].filter(Boolean))
</script>

<template>
  <footer class="border-t border-ink">
    <div class="wrap grid gap-x-14 gap-y-10 py-12 lg:grid-cols-12 lg:py-16">
      <div class="lg:col-span-5">
        <p class="font-display text-[3.4rem] font-light leading-none tracking-[-0.025em] lg:text-[4.5rem]"><ObalkaWordmark /></p>
        <p class="mt-3 font-display text-[1.05rem] italic text-quiet">{{ [settings?.tagline, settings?.footerNote].filter(Boolean).join('. ') }}</p>
      </div>
      <nav v-if="sections.length" :aria-label="words.footerSections" class="lg:col-span-2">
        <h2 class="kicker text-quiet">{{ words.sections }}</h2>
        <ul class="mt-2 text-[1rem]">
          <li v-for="s in sections" :key="s.id"><NuxtLink class="lift inline-flex h-11 items-center lg:h-9" :to="`/rubrika/${s.slug}`">{{ s.name }}</NuxtLink></li>
        </ul>
      </nav>
      <div class="lg:col-span-2">
        <h2 class="kicker text-quiet">{{ words.subscribe }}</h2>
        <ul class="mt-2 text-[1rem]">
          <li v-if="settings?.ctaUrl"><NuxtLink class="lift inline-flex h-11 items-center lg:h-9" :to="siteHref(settings.ctaUrl)">{{ settings.ctaLabel || words.newsletter }}</NuxtLink></li>
          <li v-for="s in social" :key="s.id"><a class="lift inline-flex h-11 items-center lg:h-9" :href="s.url ?? undefined" target="_blank" rel="noopener">{{ s.label }}</a></li>
        </ul>
      </div>
      <div v-if="lines.length" class="lg:col-span-3">
        <h2 class="kicker text-quiet">{{ words.imprint }}</h2>
        <p class="mt-3 text-[0.98rem] leading-[1.6]"><template v-for="(line, i) in lines" :key="i"><template v-if="i"><br></template>{{ line }}</template></p>
      </div>
    </div>
    <div class="wrap flex flex-col gap-2 border-t border-line py-6 text-[0.9rem] text-quiet sm:flex-row sm:justify-between">
      <p>© {{ years }} <ObalkaWordmark />. {{ settings?.copyNote }}</p>
      <p v-if="legal.length"><template v-for="(l, i) in legal" :key="l.id"><template v-if="i"> · </template><NuxtLink class="lift inline-flex h-11 items-center sm:h-auto" :to="l.url">{{ l.label }}</NuxtLink></template></p>
    </div>
  </footer>
</template>
