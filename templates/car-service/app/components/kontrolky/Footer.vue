<script setup lang="ts">
// Kontrolky's footer: the whole name and a line about the garage, the contact, the links of the
// page, and the company's particulars in a bar of their own, between hairlines.
const { nav } = await useSite()
const { settings, name, phone, phoneUrl, phone2, phone2Url, words, now } = await useGarage()
const links = computed(() => menuLinks(nav.value?.footer))
const legal = computed(() => menuLinks(nav.value?.legal))
const company = computed(() => [settings.value?.legalName, settings.value?.companyId && `IČO ${settings.value.companyId}`, settings.value?.vatId && `DIČ ${settings.value.vatId}`, settings.value?.registry].filter(Boolean).join(' · '))
</script>

<template>
  <footer class="border-t border-line">
    <div class="wrap py-14 grid sm:grid-cols-2 lg:grid-cols-12 gap-x-10 gap-y-9 text-[16px]">
      <div class="lg:col-span-5">
        <p class="font-display font-bold text-[26px]">{{ name }}</p>
        <p v-if="settings?.about" class="mt-3 text-quiet max-w-[28em]">{{ tidyText(settings.about) }}</p>
      </div>
      <div class="lg:col-span-3">
        <p class="text-quiet">{{ words.contact }}</p>
        <p class="mt-3 leading-[1.75]">
          <a v-if="phone" :href="phoneUrl" class="dig font-semibold text-[21px] text-brand hover:text-white">{{ phone }}</a><br v-if="phone">
          <template v-if="phone2"><a :href="phone2Url" class="dig text-[18px] hover:text-brand">{{ phone2 }}</a><br></template>
          <template v-if="settings?.email"><a :href="`mailto:${settings.email}`" class="hover:text-brand">{{ settings.email }}</a><br></template>
          {{ [settings?.street, [settings?.zip, settings?.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') }}
        </p>
      </div>
      <div class="lg:col-span-4">
        <p class="text-quiet">{{ words.onThePage }}</p>
        <ul class="mt-3 grid grid-cols-2 gap-x-6">
          <li v-for="l in links" :key="l.id"><NuxtLink class="inline-block py-1.5 hover:text-brand" :to="l.url">{{ l.label }}</NuxtLink></li>
        </ul>
      </div>
    </div>
    <div class="border-t border-line">
      <div class="wrap py-6 text-[14.5px] text-quiet flex flex-wrap gap-x-6 gap-y-1 justify-between">
        <p>{{ company }}</p>
        <p>
          <template v-for="l in legal" :key="l.id"><NuxtLink class="hover:text-brand mr-4" :to="l.url">{{ l.label }}</NuxtLink></template>
          © {{ new Date(now).getFullYear() }}
        </p>
      </div>
    </div>
  </footer>
</template>
