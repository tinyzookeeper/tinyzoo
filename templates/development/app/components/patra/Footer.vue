<script setup lang="ts">
// Patra's footer: the whole width in the brand colour, the name large with the button, then four
// columns (the developer, the building, who sells, what to download) and the small print.
const { nav, settings, name } = await useSite()
const words = useSiteWords()
const w = words.value.patra.footer
const legal = computed(() => menuLinks(nav.value?.legal))
const cta = computed(() => (settings.value?.ctaLabel && settings.value.ctaUrl ? { label: settings.value.ctaLabel, url: siteHref(settings.value.ctaUrl) } : null))
const lines = (text: string | null | undefined) => (text ?? '').split('\n').filter(Boolean)
</script>

<template>
  <footer class="on-brand bg-brand text-brand-ink">
    <div class="wrap pt-14 lg:pt-20 pb-10">
      <div class="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p class="serif text-[3rem] lg:text-[3.8rem]">{{ name }}</p>
          <p v-if="settings?.footerText" class="mt-2 opacity-90">{{ tidyText(settings.footerText) }}</p>
        </div>
        <NuxtLink v-if="cta" :to="cta.url" class="btn">{{ cta.label }}</NuxtLink>
      </div>
      <div class="mt-10 lg:mt-12 pt-8 border-t border-white/25 grid sm:grid-cols-2 lg:grid-cols-4 gap-x-10 gap-y-8 text-[0.95rem]">
        <div>
          <p class="font-medium">{{ w.developer }}</p>
          <p class="mt-2 opacity-90">
            {{ settings?.developerName }}<template v-if="settings?.developerAddress"><br>{{ settings.developerAddress }}</template>
            <template v-if="settings?.companyId || settings?.vatId"><br><span class="num"><template v-if="settings?.companyId">{{ words.companyId }} {{ settings.companyId }}</template><template v-if="settings?.companyId && settings?.vatId"> · </template><template v-if="settings?.vatId">{{ words.vatId }} {{ settings.vatId }}</template></span></template>
            <template v-if="settings?.registry"><br>{{ settings.registry }}</template>
          </p>
        </div>
        <div>
          <p class="font-medium">{{ w.site }}</p>
          <p class="mt-2 opacity-90"><template v-for="(line, i) in lines(settings?.address)" :key="i"><template v-if="i"><br></template>{{ line }}</template><template v-if="settings?.officeHours"><br>{{ w.office }} {{ settings.officeHours }}</template></p>
        </div>
        <div>
          <p class="font-medium">{{ w.sales }}</p>
          <p class="mt-2 opacity-90 num">{{ settings?.sellerName }}<template v-if="settings?.phone"><br><a class="link" :href="telHref(settings.phone)">{{ settings.phone }}</a></template><template v-if="settings?.email"><br><a class="link" :href="`mailto:${settings.email}`">{{ settings.email }}</a></template></p>
        </div>
        <div>
          <p class="font-medium">{{ w.documents }}</p>
          <p class="mt-2 opacity-90">
            <a v-if="settings?.pricelistFile" class="link" :href="settings.pricelistFile.url" target="_blank" rel="noopener">{{ w.pricelist }}</a><br v-if="settings?.pricelistFile">
            <a v-if="settings?.standardsFile" class="link" :href="settings.standardsFile.url" target="_blank" rel="noopener">{{ w.standards }}</a><br v-if="settings?.standardsFile">
            <template v-for="(l, i) in legal" :key="l.id"><br v-if="i"><NuxtLink class="link" :to="l.url">{{ l.label }}</NuxtLink></template>
          </p>
        </div>
      </div>
      <p v-if="settings?.legalText" class="mt-10 text-[0.86rem] max-w-4xl opacity-80">{{ settings.legalText }}</p>
    </div>
  </footer>
</template>
