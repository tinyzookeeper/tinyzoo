<script setup lang="ts">
// Lhůty's footer: on ink, the name and a sentence about the office, the company's details,
// the documents, and a line of copyright in mono.
const { nav } = await useSite()
const { settings, name, words, year, shortAddress } = await useOffice()
const legal = computed(() => menuLinks(nav.value?.legal))
</script>

<template>
  <footer class="bg-ink text-paper">
    <div class="wrap grid gap-10 py-14 lg:grid-cols-12">
      <div class="lg:col-span-5">
        <p class="font-display text-[24px]">{{ name }}</p>
        <p v-if="settings?.about" class="mt-2 max-w-[44ch] text-[15px] leading-[1.6] text-paper/75">{{ tidyText(settings.about) }}</p>
      </div>
      <div class="text-[14.5px] leading-[1.7] text-paper/75 lg:col-span-4">
        <p class="label mb-3 text-[11px] text-paper">{{ words.companyDetails }}</p>
        <p v-if="settings?.companyId || settings?.taxId">
          <template v-if="settings.companyId">{{ words.companyNumber }} <span class="num">{{ settings.companyId }}</span></template><template v-if="settings.companyId && settings.taxId"> · </template><template v-if="settings.taxId">{{ words.vatNumber }} <span class="num">{{ settings.taxId }}</span></template>
        </p>
        <p v-if="settings?.register">{{ words.registerLine(settings.register) }}</p>
        <p v-if="settings?.membership">{{ settings.membership }}</p>
        <p v-if="settings?.insurance">{{ settings.insurance }}</p>
      </div>
      <div v-if="legal.length" class="text-[14.5px] leading-[1.7] lg:col-span-3">
        <p class="label mb-3 text-[11px]">{{ words.documents }}</p>
        <ul>
          <li v-for="l in legal" :key="l.id"><NuxtLink class="ulink inline-flex min-h-8 items-center" :to="l.url">{{ l.label }}</NuxtLink></li>
        </ul>
      </div>
    </div>
    <div class="border-t border-paper/20">
      <p class="wrap py-5 font-mono text-[12px] text-paper/70">© {{ year }} {{ settings?.legalName || name }}<template v-if="shortAddress"> · {{ shortAddress }}</template></p>
    </div>
  </footer>
</template>
