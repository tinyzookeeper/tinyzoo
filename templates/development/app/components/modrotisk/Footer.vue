<script setup lang="ts">
// Modrotisk's footer: the title block of a drawing, a ruled box of cells (the developer, the
// building, who sells, the register, the documents, the date), and the small print under it.
const { nav, settings, name } = await useSite()
const words = useSiteWords()
const w = words.value.modrotisk.footer
const legal = computed(() => menuLinks(nav.value?.legal))
const cta = computed(() => (settings.value?.ctaLabel && settings.value.ctaUrl ? { label: settings.value.ctaLabel, url: siteHref(settings.value.ctaUrl) } : null))
const lines = (text: string | null | undefined) => (text ?? '').split('\n').filter(Boolean)
</script>

<template>
  <footer class="wrap pt-24 lg:pt-32 pb-10">
    <div class="border border-ink grid sm:grid-cols-2 lg:grid-cols-12 text-[0.94rem]">
      <div class="p-6 lg:p-8 sm:col-span-2 lg:col-span-4 lg:row-span-2 lg:border-r border-line flex flex-col justify-between gap-10">
        <div>
          <p class="font-display font-extralight text-[3.4rem] leading-[0.9] tracking-[-0.04em]">{{ name }}</p>
          <p v-if="settings?.footerText" class="mt-4 text-quiet max-w-[20rem]">{{ tidyText(settings.footerText) }}</p>
        </div>
        <NuxtLink v-if="cta" :to="cta.url" class="btn self-start">{{ cta.label }}</NuxtLink>
      </div>
      <div class="block-cell lg:col-span-3 lg:border-t-0 lg:border-r">
        <p class="label">{{ w.developer }}</p>
        <p class="mt-2">{{ settings?.developerName }}<template v-if="settings?.developerAddress"><br>{{ settings.developerAddress }}</template></p>
      </div>
      <div class="block-cell lg:col-span-3 lg:border-t-0 lg:border-r">
        <p class="label">{{ w.site }}</p>
        <p class="mt-2"><template v-for="(line, i) in lines(settings?.address)" :key="i"><br v-if="i">{{ line }}</template></p>
      </div>
      <div class="block-cell lg:col-span-2 lg:border-t-0">
        <p class="label">{{ w.sales }}</p>
        <p class="mt-2 num"><a v-if="settings?.phone" class="link" :href="telHref(settings.phone)">{{ settings.phone }}</a><template v-if="settings?.phone && settings?.email"><br></template><a v-if="settings?.email" class="link" :href="`mailto:${settings.email}`">{{ settings.email }}</a></p>
      </div>
      <div class="block-cell lg:col-span-3 lg:border-r">
        <p class="label">{{ w.identity }}</p>
        <p class="mt-2 num"><template v-if="settings?.companyId">{{ words.companyId }} {{ settings.companyId }}</template><template v-if="settings?.companyId && settings?.vatId"> · </template><template v-if="settings?.vatId">{{ words.vatId }} {{ settings.vatId }}</template><template v-if="settings?.registry"><br>{{ settings.registry }}</template></p>
      </div>
      <div class="block-cell lg:col-span-3 lg:border-r">
        <p class="label">{{ w.documents }}</p>
        <p class="mt-2">
          <a v-if="settings?.pricelistFile" class="link" :href="settings.pricelistFile.url" target="_blank" rel="noopener">{{ w.pricelist }}</a><br v-if="settings?.pricelistFile">
          <a v-if="settings?.standardsFile" class="link" :href="settings.standardsFile.url" target="_blank" rel="noopener">{{ w.standards }}</a><br v-if="settings?.standardsFile">
          <template v-for="(l, i) in legal" :key="l.id"><br v-if="i"><NuxtLink class="link" :to="l.url">{{ l.label }}</NuxtLink></template>
        </p>
      </div>
      <div class="block-cell lg:col-span-2">
        <p class="label">{{ w.asOf }}</p>
        <p class="mt-2 num">{{ dateNumbers(settings?.asOf) }}<br>{{ w.sheet }}</p>
      </div>
    </div>
    <p v-if="settings?.legalText" class="mt-6 text-[0.86rem] text-quiet max-w-4xl">{{ settings.legalText }}</p>
  </footer>
</template>
