<script setup lang="ts">
// Katastr's footer: ink, the name and a few words about the agency, the links into the offer,
// the operator as the register writes it, and the legal links.
const { nav } = await useSite()
const { settings, address, words } = await useOffice()
const w = words.value.katastr
const offer = computed(() => menuLinks(nav.value?.offer))
const legal = computed(() => menuLinks(nav.value?.legal))
const year = useState('year', () => new Date().getFullYear())
const legalLine = computed(() => tidyText([`© ${year.value}`, settings.value?.company, settings.value?.legalNote].filter(Boolean).join(' ')))
const operator = computed(() => [
  settings.value?.company,
  address.value,
  [settings.value?.companyId && `${w.companyId} ${settings.value.companyId}`, settings.value?.vatId && `${w.vatId} ${settings.value.vatId}`].filter(Boolean).join(' · '),
  settings.value?.register && `${w.register} ${settings.value.register}`,
].filter(Boolean) as string[])
</script>

<template>
  <footer class="bg-ink text-[color-mix(in_srgb,var(--paper)_78%,var(--ink))]">
    <div class="wrap py-14 grid md:grid-cols-12 gap-x-10 gap-y-10 text-[0.95rem]">
      <div class="md:col-span-5">
        <p class="serif text-paper text-[1.8rem] leading-none">{{ settings?.siteName }}<span v-if="settings?.descriptor" class="label ml-2 opacity-70">{{ settings.descriptor }}</span></p>
        <p v-if="settings?.about" class="mt-4 max-w-[24rem]">{{ tidyText(settings.about) }}</p>
      </div>
      <div v-if="offer.length" class="md:col-span-3">
        <p class="label text-paper">{{ w.offer }}</p>
        <ul class="mt-3">
          <li v-for="l in offer" :key="l.id"><NuxtLink class="inline-flex items-center min-h-[36px] hover:text-paper transition-colors" :to="l.url">{{ tidyText(l.label) }}</NuxtLink></li>
        </ul>
      </div>
      <div v-if="operator.length" class="md:col-span-4">
        <p class="label text-paper">{{ w.operator }}</p>
        <p class="mt-3 leading-[1.7]"><template v-for="(line, i) in operator" :key="i"><br v-if="i">{{ tidyText(line) }}</template></p>
      </div>
    </div>
    <div class="wrap">
      <div class="py-6 border-t border-paper/20 flex flex-wrap justify-between gap-x-8 gap-y-2 text-[0.88rem]">
        <p>{{ legalLine }}</p>
        <p v-if="legal.length" class="flex flex-wrap gap-x-6">
          <NuxtLink v-for="l in legal" :key="l.id" class="inline-flex items-center min-h-[36px] hover:text-paper transition-colors" :to="l.url">{{ l.label }}</NuxtLink>
        </p>
      </div>
    </div>
  </footer>
</template>
