<script setup lang="ts">
// Po slunci's footer: the mark and a line about the house, three plain columns (the developer,
// the building and its sales, what to download) and the small print under a dotted line.
const { nav, settings, name } = await useSite()
const words = useSiteWords()
const w = words.value.poSlunci.footer
const legal = computed(() => menuLinks(nav.value?.legal))
const address = computed(() => (settings.value?.address ?? '').split('\n').filter(Boolean).join(', '))
</script>

<template>
  <footer class="wrap pt-16 lg:pt-20 pb-10">
    <div class="grid sm:grid-cols-2 lg:grid-cols-12 gap-x-12 gap-y-8 text-[0.96rem]">
      <div class="sm:col-span-2 lg:col-span-4">
        <p class="flex items-center gap-2.5"><PoSlunciWordmark class="[&_[data-wordmark]]:text-[1.9rem]" /></p>
        <p v-if="settings?.footerText" class="mt-4 text-quiet max-w-[20rem]">{{ tidyText(settings.footerText) }}</p>
      </div>
      <div class="lg:col-span-3">
        <p class="font-semibold">{{ w.developer }}</p>
        <p class="mt-2 text-quiet">
          {{ settings?.developerName }}<template v-if="settings?.developerAddress"><br>{{ settings.developerAddress }}</template>
          <template v-if="settings?.companyId || settings?.vatId"><br><span class="num"><template v-if="settings?.companyId">{{ words.companyId }} {{ settings.companyId }}</template><template v-if="settings?.companyId && settings?.vatId"> · </template><template v-if="settings?.vatId">{{ words.vatId }} {{ settings.vatId }}</template></span></template>
          <template v-if="settings?.registry"><br>{{ settings.registry }}</template>
        </p>
      </div>
      <div class="lg:col-span-3">
        <p class="font-semibold">{{ w.sales }}</p>
        <p class="mt-2 text-quiet">{{ address }}<template v-if="settings?.officeHours"><br>{{ w.office }} {{ settings.officeHours }}</template><template v-if="settings?.phone || settings?.email"><br><a v-if="settings?.phone" class="link num" :href="telHref(settings.phone)">{{ settings.phone }}</a><template v-if="settings?.phone && settings?.email"> · </template><a v-if="settings?.email" class="link" :href="`mailto:${settings.email}`">{{ settings.email }}</a></template></p>
      </div>
      <div class="lg:col-span-2">
        <p class="font-semibold">{{ w.documents }}</p>
        <p class="mt-2 text-quiet">
          <a v-if="settings?.pricelistFile" class="link" :href="settings.pricelistFile.url" target="_blank" rel="noopener">{{ w.pricelist }}</a><br v-if="settings?.pricelistFile">
          <a v-if="settings?.standardsFile" class="link" :href="settings.standardsFile.url" target="_blank" rel="noopener">{{ w.standards }}</a><br v-if="settings?.standardsFile">
          <template v-for="(l, i) in legal" :key="l.id"><br v-if="i"><NuxtLink class="link" :to="l.url">{{ l.label }}</NuxtLink></template>
        </p>
      </div>
    </div>
    <p v-if="settings?.legalText" class="mt-10 pt-6 border-t-2 border-dotted text-[0.86rem] text-quiet" style="border-color:var(--dash)">{{ settings.legalText }}</p>
  </footer>
</template>
