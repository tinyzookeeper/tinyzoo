<script setup lang="ts">
// Šuplíky's footer: the whole name in bold italic and a line about the garage, the contact, the
// links of the page, and the company's particulars in a bar of their own.
const { nav } = await useSite()
const { settings, name, phone, phoneUrl, phone2, phone2Url, words, now } = await useGarage()
const links = computed(() => menuLinks(nav.value?.footer))
const legal = computed(() => menuLinks(nav.value?.legal))
const company = computed(() => [settings.value?.legalName, settings.value?.companyId && `IČO ${settings.value.companyId}`, settings.value?.vatId && `DIČ ${settings.value.vatId}`, settings.value?.registry].filter(Boolean).join(' · '))
</script>

<template>
  <footer class="bg-ink text-white">
    <div class="wrap py-12 grid sm:grid-cols-2 lg:grid-cols-12 gap-x-10 gap-y-8 text-[16px]">
      <div class="lg:col-span-5">
        <p class="font-display italic font-extrabold text-[32px] leading-none">{{ name }}</p>
        <p v-if="settings?.about" class="mt-4 text-white/80 max-w-[26em]">{{ tidyText(settings.about) }}</p>
      </div>
      <div class="lg:col-span-3">
        <p class="kicker text-white/70">{{ words.contact }}</p>
        <p class="mt-3 leading-[1.7]">
          <a v-if="phone" :href="phoneUrl" class="num text-[22px] hover:underline underline-offset-4">{{ phone }}</a><br v-if="phone">
          <template v-if="phone2"><a :href="phone2Url" class="hover:underline underline-offset-4">{{ phone2 }}</a><br></template>
          <template v-if="settings?.email"><a :href="`mailto:${settings.email}`" class="hover:underline underline-offset-4">{{ settings.email }}</a><br></template>
          {{ [settings?.street, [settings?.zip, settings?.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') }}
        </p>
      </div>
      <div class="lg:col-span-4">
        <p class="kicker text-white/70">{{ words.onThePage }}</p>
        <ul class="mt-3 grid grid-cols-2 gap-x-6">
          <li v-for="l in links" :key="l.id"><NuxtLink class="inline-block py-1.5 hover:underline underline-offset-4" :to="l.url">{{ l.label }}</NuxtLink></li>
        </ul>
      </div>
    </div>
    <div class="border-t border-white/15">
      <div class="wrap py-5 text-[14px] text-white/75 flex flex-wrap gap-x-6 gap-y-1 justify-between">
        <p>{{ company }}</p>
        <p>
          <template v-for="l in legal" :key="l.id"><NuxtLink class="hover:underline underline-offset-4 mr-4" :to="l.url">{{ l.label }}</NuxtLink></template>
          © {{ new Date(now).getFullYear() }}
        </p>
      </div>
    </div>
  </footer>
</template>
